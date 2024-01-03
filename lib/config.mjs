import { MessageTypes } from 'midi-message-parser'
import { validKeyModifiers, validKeys } from './keys.mjs'

export function parseConfig(config) {
  const { preferredInput = null, keyStrokes = [] } = config
  const matchersByType = new Map()
  for (const { key: keyDef, midi } of keyStrokes) {
    const key = parseKeyStrokes(keyDef)
    const matchers = midi.map(parseMidiConfig)
    for (let matcher of matchers) {
      const { type } = matcher
      let ms = matchersByType.get(type)
      if (!ms) {
        ms = []
        matchersByType.set(type, ms)
      }
      ms.push({ ...matcher, key })
    }
  }
  const matcherFunctionsByType = new Map(
    Array.from(matchersByType.entries()).map(([type, matchers]) => [type, midiTypeMatchers[type](matchers)]),
  )
  return { preferredInput, matcherFunctionsByType }
}
function parseKeyStrokes(keyDef) {
  return Array.isArray(keyDef) ? keyDef.map(parseKeyStroke) : [parseKeyStroke(keyDef)]
}

function parseKeyStroke(keyDef) {
  const parts = keyDef.split(/\s?[\s\+\-]\s?/)
  const modifiers = parts.slice(0, parts.length - 1)
  const key = parts[parts.length - 1].trim()
  const invalidModifiers = modifiers.filter((m) => !validKeyModifiers.has(m))
  if (key.length === 0) {
    throw new Error(`Invalid key stroke: "${keyDef}". No key specified`)
  }
  if (key.length > 1 && !validKeys.has(key)) {
    throw new Error(
      `Invalid key stroke: "${keyDef}". Invalid key: "${key}"${
        invalidModifiers.length > 0 ? ` and invalid modifiers: "${invalidModifiers.join('", "')}"` : ''
      }`,
    )
  }
  return { modifiers, key }
}

function parseMidiConfig(midi) {
  let { type, cc, on, off, ...rest } = midi
  if (typeof type === 'string') {
    type = type.toLowerCase()
  } else if (typeof cc !== 'undefined') {
    type = MessageTypes.CC
    rest.number = cc
  } else if (typeof on !== 'undefined') {
    type = MessageTypes.NOTE_ON
    rest.number = on
    rest.value = rest.velocity
  } else if (typeof off !== 'undefined') {
    type = MessageTypes.NOTE_OFF
    rest.number = off
    rest.value = rest.velocity
  }

  let parser = midiTypeParsers[type]
  if (!parser) {
    const alternative = midiAlternatives.get(type)
    if (alternative) {
      type = alternative
      parser = midiTypeParsers[type]
    } else {
      throw new Error(`Invalid midi definition. Invalid MIDI type: ${type}:\n${JSON.stringify(midi)}`)
    }
  }
  const parsed = parser(rest, type)
  return parsed
}

const allChannels = 0
const allValues = 'all'

function isAny(value) {
  return value == null || (typeof value === 'string' && value.match(new RegExp(`^a(ll|ny)$`)))
}
const midiTypeParsers = {
  [MessageTypes.CC]: (midi, type) => parseStandardMessage(midi, type, 'value'),
  [MessageTypes.NOTE_OFF]: (midi, type) => parseStandardMessage(midi, type, 'velocity'),
  [MessageTypes.NOTE_ON]: (midi, type) => parseStandardMessage(midi, type, 'velocity'),
}

function parseStandardMessage(midi, type, valueType) {
  let { number } = midi
  const { channel, value } = midi
  if (typeof number === 'string') {
    number = parseInt(number)
  }
  const channels = parseChannels(channel, type, midi)
  const values = parseValues(value, type, valueType, midi)
  return { type, channels, number, values }
}

function parseChannels(channel, type, midi) {
  if (isAny(channel)) {
    return [allChannels]
  }
  if (typeof channel === 'string') {
    return [parseInt(channel)]
  }
  if (typeof channel !== 'number' || channel < 1 || channel > 16) {
    throw new Error(`Invalid  ${type} definition. Invalid channel: ${channel}:\n${JSON.stringify(midi)}`)
  }
  return [channel]
}

function parseValues(value, type, valueType, midi) {
  let values
  if (isAny(value)) {
    values = [allValues]
  } else {
    if (typeof value === 'string') {
      value = parseInt(value)
    }
    if (typeof value !== 'number' || value < 0 || value > 127) {
      throw new Error(`Invalid ${type} definition. Invalid ${valueType}: ${value}:\n${JSON.stringify(midi)}`)
    } else {
      values = [value]
    }
  }
  return values
}

const midiTypeMatchers = {
  [MessageTypes.CC]: matchStandardMessage,
  [MessageTypes.NOTE_OFF]: matchStandardMessage,
  [MessageTypes.NOTE_ON]: matchStandardMessage,
}

function matchStandardMessage(definitions) {
  var byNumber = new Map()
  for (let definition of definitions) {
    const { number, channels, values, key } = definition
    let byChannel = byNumber.get(number)
    if (!byChannel) {
      byChannel = []
      byNumber.set(number, byChannel)
    }
    for (let channel of channels) {
      let byValue = byChannel[channel]
      if (!byValue) {
        byValue = {}
        byChannel[channel] = byValue
      }
      for (let value of values) {
        let keys = byValue[value]
        if (!keys) {
          keys = []
          byValue[value] = keys
        }
        keys.push(key)
      }
    }
  }
  return function parseStandardMessage({ channel, number, value }) {
    const byChannel = byNumber.get(number)
    if (!byChannel) return null
    const byValue = byChannel[channel] ?? byChannel[allChannels]
    if (!byValue) return null
    const keys = byValue[value] ?? byValue[allValues] ?? null
    return keys
  }
}

const midiAlternatives = new Map([
  ['on', MessageTypes.NOTE_ON],
  ['off', MessageTypes.NOTE_OFF],
  ['cc', MessageTypes.CC],
  ['pg', MessageTypes.PROGRAM_CHANGE],
])
