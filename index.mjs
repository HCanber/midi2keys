import midiPkg from 'midi'
import enquirerPkg from 'enquirer'
import robotjsPkg from 'robotjs'
import hasPermissions from 'macos-accessibility-permissions'
import { program } from 'commander'
import stripJsonComments from 'strip-json-comments'
import fs from 'node:fs/promises'
import path from 'node:path'
import { MidiMessage, MessageTypes } from 'midi-message-parser'
import { parseConfig } from './lib/config.mjs'

const { Input } = midiPkg
const { Confirm, Select } = enquirerPkg
const { keyTap } = robotjsPkg

const defaultConfigFile = 'example_config.jsonc'
const emptyStringFormat = () => ''

program
  .version('0.1.0')
  .option('-c, --config <filename>', 'Specify a config file')
  .option('-d, --debug', 'Enable debugging')
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
let configPath
if (!configFilename) {
  console.log('No config file specified. Use -c <filename> to specify a config file.')
  const useDefaultConfig = await new Confirm({
    message: `Use default: ${defaultConfigFile}?`,
    format: emptyStringFormat,
  }).run()
  if (!useDefaultConfig) {
    process.exit(0)
  }
  configPath = path.resolve(defaultConfigFile)
} else {
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
let config
if (await fileExists(configPath)) {
  const json = JSON.parse(stripJsonComments(await fs.readFile(configPath, 'utf8')))
  config = parseConfig(json)
} else {
  config = {}
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
  ifDebug((log) => {
    const p = parsedToConfig(parsed).join(', ')
    const strKeys = keys ? ` => Key: ${keys.map((k) => `\u001b[1m${keyToString(k)}\u001b[0m`).join(', ')}` : ''
    const message = `MIDI: ${p}${strKeys}`
    return log(message)
  })
})

function parsedToConfig(parsed) {
  switch (parsed.type) {
    case MessageTypes.CC:
      return [`cc:${parsed.number}`, `ch:${parsed.channel}`, parsed.value]
    case MessageTypes.NOTE_ON:
      return [`on:${parsed.number}`, `ch:${parsed.channel}`, parsed.value]
    case MessageTypes.NOTE_OFF:
      return [`off:${parsed.number}`, `ch:${parsed.channel}`, parsed.value]
    default:
      return [`${parsed.type}`, parsed.number, `ch:${parsed.channel}`, parsed.value]
  }
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
