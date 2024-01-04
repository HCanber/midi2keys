import Path from 'node:path'
import { program } from 'commander'
import enquirerPkg from 'enquirer'
import hasPermissions from 'macos-accessibility-permissions'
import { MessageTypes, MidiMessage } from 'midi-message-parser'
import robotjsPkg from 'robotjs'
import { parseConfig } from './lib/config.mjs'
import { debugLog, setDebugLog } from './lib/debugLog.mjs'
import { fileExists, getDirName, readFile, writeFile } from './lib/fs.mjs'
import { parseJson, parseJsonFile } from './lib/json.mjs'
import { getInputAndMidiPorts } from './lib/midi.mjs'
import { uppercaseFirstLetter } from './lib/string.mjs'

const { Confirm, Select } = enquirerPkg
const { keyTap } = robotjsPkg

const defaultConfigFile = 'midikeys_config.jsonc'
const exampleConfigFile = 'example_config.jsonc'
const emptyStringFormat = () => ''

const __dirname = getDirName(import.meta.url)
const packageJson = await parseJsonFile(Path.resolve(__dirname, './package.json'))

program
  .option('-c, --config <filename>', 'The config file to use')
  .option(
    '-i, --input <name>',
    'The name of the midi input to use. Use --list-inputs to list available inputs. Will override preferredInput in config file.',
  )
  .option('-m, --monitor', 'Enable logging of received midi messages')
  .option('-d, --debug', 'Enable debug logging, including logging of received midi messages')
  .option('    --list-inputs', 'List available midi inputs')
  .option(
    '    --create-config [filename]',
    'Creates a config file based on example config. Use this as a starting point',
  )
  .version(packageJson.version, '-v, --version', 'Outputs the version number')
  .helpOption('-h, --help', 'Display this help')
  .showSuggestionAfterError(true)
  .showHelpAfterError(true)
  .parse(process.argv)

// Show help if "/?" is passed as argument
if (process.argv.some((arg) => arg === '/?')) {
  program.help() // will exit
}

var args = program.opts()
setDebugLog(args.debug)

if (args.createConfig) {
  const createConfigArgument = args.createConfig
  let configFilename = typeof createConfigArgument === 'string' ? createConfigArgument : defaultConfigFile
  if (await fileExists(configFilename)) {
    console.error(
      `File ${configFilename} already exists. Use \u001b[1m--create-config <filename>\u001b[0m to specify a different filename.`,
    )
    process.exit(1)
  }
  await createConfigFile(exampleConfigFile, configFilename)
  console.log(`Created ${configFilename}`)
  process.exit(0)
}

let configFilename = args.config
let configPath = null
const shouldProcessConfig = !args.listInputs
if (shouldProcessConfig) {
  if (!configFilename && !args.monitor) {
    const suggestedFilename = (await fileExists(defaultConfigFile))
      ? defaultConfigFile
      : (await fileExists(exampleConfigFile))
      ? exampleConfigFile
      : null

    if (suggestedFilename) {
      configPath = Path.resolve(suggestedFilename)
    } else if (!args.monitor) {
      console.log('No config file specified. Use --create-config to create one. Exiting.')
      process.exit(0)
    }
  } else if (configFilename) {
    configPath = Path.resolve(configFilename)
    if (!(await fileExists(configPath))) {
      console.log(`Config file ${configPath} does not exist.`)
      const createFile = await new Confirm({ message: `Create it?`, format: emptyStringFormat }).run()
      if (!createFile) {
        console.log('Use --config <filename> to specify a config file.')
        process.exit(0)
      }
      await createConfigFile(exampleConfigFile, configPath)
      console.log(`Created ${configFilename}`)
    }
  }
}
const { input, midiPorts } = getInputAndMidiPorts()

if (args.listInputs) {
  console.log('Available MIDI inputs:')
  for (const { name } of midiPorts) {
    console.log(`  "${name}"`)
  }
  process.exit(0)
}
// Read config file if it exists
let config = null
if (configPath && (await fileExists(configPath))) {
  debugLog(
    `${
      !configFilename ? 'No config file specified. Use -c <filename> to specify a config file.\n' : ''
    }Using config file: ${configPath}`,
  )

  const fileContents = (await readFile(configPath)).trim()
  if (fileContents.length > 0) {
    const json = parseJson(fileContents)
    config = parseConfig(json)
  }
}
if (config === null) {
  config = { matcherFunctionsByType: new Map() }
}

let { preferredInput = null } = config
const { matcherFunctionsByType } = config

if (args.input) {
  preferredInput = args.input
}

let selectedPortIndex = null
let selectedPortName = null
let choices = midiPorts.map(({ name, index }) => ({ name, value: index }))
if (preferredInput) {
  const port = midiPorts.find((p) => p.name === preferredInput)
  if (port) {
    selectedPortIndex = port.index
    selectedPortName = port.name
    choices = null
  }
}

if (choices) {
  const portPrompt = new Select({
    name: 'port',
    message: 'Select an input port:',
    choices: choices,
    result(name) {
      console.log(name)
      return this.find(name)
    },
  })
  const portPromptAnswer = await portPrompt.run()
  selectedPortIndex = portPromptAnswer.value
  selectedPortName = portPromptAnswer.name
}

// If running on macOS, check if Accessibility permissions are granted. They are neede to be able to send key strokes.
if (matcherFunctionsByType.size > 0 && process.platform === 'darwin') {
  if (!hasPermissions()) {
    const isIterm = process.env.TERM_PROGRAM === 'iTerm.app'
    // Log in italic
    console.log('\u001b[1mIn order to be able to send key strokes, accessibility permissions must be granted.\u001b[0m')
    // prettier-ignore
    console.log(`Under (\u001b[3mSystem Settings > Privacy & Security > Accessibility\u001b[0m, grant ${isIterm ? '\u001b[1miTerm\u001b[0m' : 'the terminal'}.\n`)
    process.stdin.resume()
    hasPermissions({ ask: true })
    // Write to stdout witout newline
    process.stdout.write('Waiting for permissions to be granted... (Ctrl-C to exit)')
    while (!hasPermissions()) {
      // Wait for permissions to be granted
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    // Clear line and return to start of line
    process.stdout.write('\u001b[2K\u001b[0G')
  }
  debugLog('\u001b[32m✓\u001b[0m Permissions to send key strokes granted!\n')
}
var monitorIncomingMidi = args.monitor

input.openPort(selectedPortIndex)
console.log(
  `\u001b[32m✓\u001b[0m Connected to \u001b[3m${selectedPortName}\u001b[0m.\n${
    monitorIncomingMidi ? '  Monitoring incoming MIDI messages.\n' : ''
  }  Press \u001b[1mCTRL+C\u001b[0m to exit\n`,
)

input.on('message', (deltaTime, message) => {
  const parsed = new MidiMessage(message, deltaTime)
  var matcherFn = matcherFunctionsByType.get(parsed.type)
  let keys = null
  if (matcherFn) {
    keys = matcherFn(parsed)
    if (keys) {
      for (const k of keys) {
        for (const { key, modifiers } of k) {
          keyTap(key, modifiers)
        }
      }
    }
  }
  if (monitorIncomingMidi) {
    const p = parsedToConfig(parsed).join(', ')
    const strKeys = keys ? ` => Key: ${keys.map((k) => `\u001b[1m${keyToString(k)}\u001b[0m`).join(', ')}` : ''
    const message = `MIDI: ${p}${strKeys}`
    return console.log(message)
  }
})

process.on('SIGINT', function () {
  process.exit(0)
})

async function createConfigFile(sourceConfigFile, configFilename) {
  let exampleConfig = await readFile(Path.resolve(__dirname, sourceConfigFile))
  const { midiPorts } = getInputAndMidiPorts()
  const none = '<None>'
  let choices = [...midiPorts.map(({ name }) => ({ name, value: name })), { name: none, value: none }]
  const portPrompt = new Select({
    name: 'port',
    message: 'Select port to set as preferredInput in config file',
    choices: choices,
    result(name) {
      return this.find(name)
    },
  })

  const selectedPort = await portPrompt.run()
  // Replace preferredInput with selected port
  var { preferredInput: prefInput } = parseJson(exampleConfig)
  exampleConfig = exampleConfig.replace(prefInput, selectedPort.value === none ? '' : selectedPort.value)
  await writeFile(configFilename, exampleConfig)
}

function parsedToConfig(parsed) {
  let type
  let value
  switch (parsed.type) {
    case MessageTypes.CC:
      type = 'cc'
      value = 'value'
      break
    case MessageTypes.NOTE_ON:
      type = 'on'
      value = 'velocity'
      break
    case MessageTypes.NOTE_OFF:
      type = 'off'
      value = 'velocity'
      break
    default:
      type = parsed.type
      value = 'value'
      break
  }
  return [
    `${type.padStart(3)}`,
    parsed.number.toString().padStart(3),
    `ch: ${parsed.channel.toString().padStart(2)}`,
    `${value.padStart(8)}: ${parsed.value.toString().padStart(3)}`,
  ]
}

function keyToString(k) {
  const ks = Array.isArray(k) ? k : [k]
  return ks
    .map(({ key, modifiers }) => {
      var sKey = uppercaseFirstLetter(key)
      return modifiers?.length ? `${modifiers.map(uppercaseFirstLetter).join('+')} + ${sKey}` : sKey
    })
    .join(', ')
}
