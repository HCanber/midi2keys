import Path from 'node:path'
import { program, Option } from 'commander'
import enquirerPkg from 'enquirer'
import hasPermissions from 'macos-accessibility-permissions'
import { MessageTypes, MidiMessage } from 'midi-message-parser'
import robotjsPkg from 'robotjs'
import { parseConfig } from './lib/config.mjs'
import { debugLog, setDebugLog, shouldDebugLog } from './lib/debugLog.mjs'
import { fileExists, getDirName, readFile, writeFile } from './lib/fs.mjs'
import { parseJson, parseJsonFile } from './lib/json.mjs'
import { getInputAndMidiPorts } from './lib/midi.mjs'
import { uppercaseFirstLetter } from './lib/string.mjs'

const { Select } = enquirerPkg
const { keyTap } = robotjsPkg

const defaultConfigFile = 'midikeys_config.jsonc'
const exampleConfigFile = 'example_config.jsonc'

const __dirname = getDirName(import.meta.url)
const packageJson = await parseJsonFile(Path.resolve(__dirname, './package.json'))

const cmdName_Normal = 'run'
const helpOptions = ['-h, --help', 'Displays this help']
program
  .command('create-config')
  .argument('[filename]', 'Optional filename for config file')
  .description('Creates a config file based on example config. Use this as a starting point')
  .action((filename) => handleCreateConfig(filename))

program.command('list-inputs').description('List available midi inputs').action(handleListMidiInputs)
program
  .command('monitor')
  .description('Logs received midi messages')
  .option('-i, --input <name>', 'The name of the midi input to use. Use list-inputs to list available inputs.')
  .helpOption(...helpOptions)
  .action((options) => {
    console.log('Tip! You can also specify --monitor when running the normal command\n')
    return connectAndHandleMidiMessages(null, options.input, true)
  })

var defaultCommand = program
  .command(cmdName_Normal, { isDefault: true, hidden: true })
  .usage('[options] [--config <filename>]')
  .description(
    'Perform actions based on received midi messages as defined in config file.\nSpecify "help" to see full help',
  )
  .option('-c, --config <filename>', `The config file to use. If not specified, will use ${defaultConfigFile}.`)
  .option('-d, --debug', 'Enable debug logging, including logging of received midi messages')
  .option(
    '-i, --input <name>',
    'The name of the midi input to use. Use list-inputs to list available inputs. Will override preferredInput in config file.',
  )
  .option('-m, --monitor', 'Enable logging of received midi messages')
  .addOption(new Option('--how').hideHelp())
  .helpOption(...helpOptions)
  .allowExcessArguments(false)
  .action((options) => handleDefault(options))

// Hack to prevent help for the default command to display command name
const defaultCommandHelpInformation = defaultCommand.helpInformation.bind(defaultCommand)
defaultCommand.helpInformation = function patchedHelpInformation(...args) {
  const name = this._name
  this._name = ''
  try {
    const result = defaultCommandHelpInformation(...args)
    let topCmd
    for (topCmd = this; topCmd.parent; topCmd = topCmd.parent) {}
    const programName = topCmd.name()
    return result.replace(programName + '  ', programName + ' ')
  } finally {
    this._name = name
  }
}
program
  .description(
    'This program listens on incoming midi messages and performs different actions in response to the messages. What actions to take are specified in a config file.\n' +
      'Specify "--help" to see options for the normal command.\n' +
      'Specify "monitor" to only log incoming midi messages.\n',
  )
  .version(packageJson.version, '-v, --version', 'Outputs the version number')
  .helpOption(helpOptions[0], "Displays help for the program. Specify 'help <command>' to see help for a command.")
  .showSuggestionAfterError(true)
  .showHelpAfterError(true)

const argsToParse = // If only --help has been specified show help for the normal command
  process.argv.length === 3 && process.argv[2] === '--help'
    ? [...process.argv.slice(0, 2), 'help', 'run']
    : // Special treatment: Show help if "/?" is passed as argument
    process.argv.some((arg) => arg === '/?')
    ? [...process.argv.slice(0, 2), 'help', 'run']
    : process.argv

await program.parseAsync(argsToParse)

async function handleDefault({
  debug: shouldDebugLog,
  config: configFilename,
  input: configPreferredInput,
  monitor: monitorIncomingMidi,
}) {
  setDebugLog(shouldDebugLog)

  let config = await loadConfig(configFilename)

  // If running on macOS, check if Accessibility permissions are granted. They are neede to be able to send key strokes.
  if (config?.matcherFunctionsByType.size > 0 && process.platform === 'darwin') {
    if (!hasPermissions()) {
      const isIterm = process.env.TERM_PROGRAM === 'iTerm.app'
      // Log in italic
      console.log(
        '\u001b[1mIn order to be able to send key strokes, accessibility permissions must be granted.\u001b[0m',
      )
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

  await connectAndHandleMidiMessages(config, configPreferredInput, monitorIncomingMidi)
}

async function connectAndHandleMidiMessages(config, configPreferredInput, monitorIncomingMidi) {
  if (config === null) {
    config = { matcherFunctionsByType: new Map() }
  }

  let { preferredInput = null } = config
  const { matcherFunctionsByType } = config

  // If --input is specified, override preferredInput in config file
  if (configPreferredInput) {
    preferredInput = configPreferredInput
  }

  const { midiInput, midiPorts } = getInputAndMidiPorts()

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
        return this.find(name)
      },
    })
    const portPromptAnswer = await portPrompt.run()
    selectedPortIndex = portPromptAnswer.value
    selectedPortName = portPromptAnswer.name
  }

  midiInput.openPort(selectedPortIndex)
  console.log(
    `\u001b[32m✓\u001b[0m Connected to \u001b[3m${selectedPortName}\u001b[0m.\n${
      monitorIncomingMidi ? '  Monitoring incoming MIDI messages.\n' : ''
    }  Press \u001b[1mCTRL+C\u001b[0m to exit\n`,
  )

  midiInput.on('message', (deltaTime, message) => {
    const parsed = new MidiMessage(message, deltaTime)
    var matcherFn = matcherFunctionsByType.get(parsed.type)
    let keys = null
    if (matcherFn) {
      keys = matcherFn(parsed)
      if (keys) {
        for (const k of keys) {
          for (const { key, modifiers } of k) {
            try {
              keyTap(key, modifiers)
            } catch (e) {
              console.error(
                `\u001b[31mFailed to send key stroke \u001b[1m${keyToString(k)}\u001b[0m: \u001b[31m${
                  e.message
                }\u001b[0m`,
              )
            }
          }
        }
      }
    }
    if (monitorIncomingMidi) {
      const p = parsedToConfig(parsed).join(', ')
      let message = `MIDI: ${p}`
      if (shouldDebugLog() && keys) {
        message = `${message} => Key: ${keys.map((k) => `\u001b[1m${keyToString(k)}\u001b[0m`).join(', ')}`
      }
      return console.log(message)
    }
  })

  process.on('SIGINT', function () {
    process.exit(0)
  })
  return config
}

async function handleCreateConfig(specifiedFilename) {
  let configFilename = typeof specifiedFilename === 'string' ? specifiedFilename : defaultConfigFile
  if (await fileExists(configFilename)) {
    console.error(
      `File ${configFilename} already exists. Use \u001b[1m--create-config <filename>\u001b[0m to specify a different filename.`,
    )
    process.exit(1)
  }
  console.log('About to create config file.')
  await createConfigFile(exampleConfigFile, configFilename)
  console.log(`Created ${configFilename}`)
  process.exit(0)
}

function handleListMidiInputs() {
  const { midiPorts } = getInputAndMidiPorts()

  console.log('Available MIDI inputs:')
  for (const { name } of midiPorts) {
    console.log(`  "${name}"`)
  }
  process.exit(0)
}

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

async function loadConfig(specifiedConfigFile = null) {
  let configFilename = specifiedConfigFile
  let configPath = null
  if (configFilename) {
    configPath = Path.resolve(configFilename)
    if (!(await fileExists(configPath))) {
      console.error(`Config file ${configPath} does not exist. Use create-config ${configFilename} to create it.`)
      process.exit(1)
    }
  } else {
    const suggestedFilename = (await fileExists(defaultConfigFile))
      ? defaultConfigFile
      : (await fileExists(exampleConfigFile))
      ? exampleConfigFile
      : null

    if (!suggestedFilename) {
      console.log('No config file specified. Use create-config to create one. Exiting.')
      process.exit(1)
    }
    configPath = Path.resolve(suggestedFilename)
  }
  debugLog(
    `${
      !configFilename ? 'No config file specified. Use -c <filename> to specify a config file.\n' : ''
    }Using config file: ${configPath}`,
  )

  const json = await parseJsonFile(configPath, { defaultWhenEmpty: null })
  return json ? parseConfig(json) : null
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
      return modifiers?.length ? `${modifiers.map(uppercaseFirstLetter).join('+')}+${sKey}` : sKey
    })
    .join(', ')
}
