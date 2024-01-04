let _debugLog
let _ifDebug
const noop = () => {}

export function setDebugLog(shouldLog) {
  _debugLog = shouldLog ? console.log : noop
  _ifDebug = shouldLog ? (fn) => fn(console.log) : noop
}

export function debugLog(...args) {
  _debugLog(...args)
}

export function ifDebug(fn) {
  _ifDebug(fn)
}
