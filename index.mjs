import fs from 'node:fs/promises'
import path from 'node:path'
import { program } from 'commander'
import enquirerPkg from 'enquirer'
import hasPermissions from 'macos-accessibility-permissions'
import midiPkg from 'midi'
import { MessageTypes, MidiMessage } from 'midi-message-parser'
import robotjsPkg from 'robotjs'
import stripJsonComments from 'strip-json-comments'
import { parseConfig } from './lib/config.mjs'

const { Input } = midiPkg
const { Confirm, Select } = enquirerPkg
const { keyTap } = robotjsPkg

const defaultConfigFile = 'config.jsonc'
const exampleConfigFile = 'example_config.jsonc'
const emptyStringFormat = () => ''

program
  .version('0.1.0')
  .option('-c, --config <filename>', 'The config file to use')
  .option('-m, --monitor', 'Enable logging of received midi messages')
  .option('-c, --config <filename>', 'The config file to use')
  .option('-d, --debug', 'Enable debug logging, including logging of received midi messages')
  .parse(process.argv)

var args = program.opts()
const debugLog = args.debug ? console.log : () => {}
const ifDebug = args.debug ? (fn) => fn(console.log) : () => {}

// If running on macOS, check if Accessibility permissions are granted. They are neede to be able to send key strokes.
if (process.platform === 'darwin') {
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

let configFilename = args.config
let configPath = null
if (!configFilename && !args.monitor) {
  console.log('No config file specified. Use -c <filename> to specify a config file.')
  const defaultConfigFileExists = await fileExists(defaultConfigFile)
  const suggestedFilename = defaultConfigFileExists ? defaultConfigFile : exampleConfigFile
  const useDefaultConfig = await new Confirm({
    message: `Use: ${suggestedFilename}?`,
    format: emptyStringFormat,
    initial: true,
  }).run()
  if (useDefaultConfig) {
    configPath = path.resolve(suggestedFilename)
  } else if (!args.monitor) {
    console.log('No config file specified and --monitor has not been specified. Exiting.')
    process.exit(0)
  }
} else if (configFilename) {
  configPath = path.resolve(configFilename)
  if (!(await fileExists(configPath))) {
    console.log(`Config file ${configPath} does not exist.`)
    const createFile = await new Confirm({ message: `Create it?`, format: emptyStringFormat }).run()
    if (!createFile) {
      process.exit(0)
    }
  }
}

// Read config file if it exists
let config = null
if (configPath && (await fileExists(configPath))) {
  const fileContents = (await fs.readFile(configPath, 'utf8')).trim()
  if (fileContents.length > 0) {
    const json = JSON.parse(stripJsonComments(fileContents))
    config = parseConfig(json)
  }
}
if (config === null) {
  config = { matcherFunctionsByType: new Map() }
}

const { preferredInput, matcherFunctionsByType } = config

// Set up a new input.
const input = new Input()

// Count the available input ports.
const numberOfPorts = input.getPortCount()
let selectedPortIndex = null
let selectedPortName = null
let options = []
for (let i = 0; i < numberOfPorts; i++) {
  const portName = input.getPortName(i)
  if (portName === preferredInput) {
    selectedPortIndex = i
    selectedPortName = preferredInput
    options = null
    break //stop looping
  }
  options.push({ name: portName, value: i })
}
if (options) {
  const portPrompt = new Select({
    name: 'port',
    message: 'Select an input port:',
    choices: options,
    result(name) {
      return this.find(name)
    },
  })
  const portPromptAnswer = await portPrompt.run()
  selectedPortIndex = portPromptAnswer.value
  selectedPortName = portPromptAnswer.name
}

const selectedInput = new Input()
selectedInput.openPort(selectedPortIndex)
console.log(
  `\u001b[32m✓\u001b[0m Connected to \u001b[3m${selectedPortName}\u001b[0m Press \u001b[1mCTRL+C\u001b[0m to exit\n`,
)

selectedInput.on('message', (deltaTime, message) => {
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
  if (args.monitor) {
    const p = parsedToConfig(parsed).join(', ')
    const strKeys = keys ? ` => Key: ${keys.map((k) => `\u001b[1m${keyToString(k)}\u001b[0m`).join(', ')}` : ''
    const message = `MIDI: ${p}${strKeys}`
    return console.log(message)
  }
})

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

function uppercaseFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
// console.log('Listening for MIDI messages...')
async function fileExists(filename) {
  try {
    await fs.access(filename)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    } else {
      throw err
    }
  }
}
