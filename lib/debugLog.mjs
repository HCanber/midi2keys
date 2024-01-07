let _debugLog
let _ifDebug
let _shouldDebugLog = false
const noop = () => {}

export function setDebugLog(shouldDebugLog) {
  _shouldDebugLog = shouldDebugLog
  _debugLog = shouldDebugLog ? console.log : noop
  _ifDebug = shouldDebugLog ? (fn) => fn(console.log) : noop
}

export function debugLog(...args) {
  _debugLog(...args)
}

export function ifDebug(fn) {
  _ifDebug(fn)
}

export function shouldDebugLog() {
  return _shouldDebugLog
}
