import fs from 'node:fs/promises'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'

// console.log('Listening for MIDI messages...')
export async function fileExists(filename) {
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

export function getDirName(importMetaUrl) {
  return Path.dirname(fileURLToPath(importMetaUrl))
}

export async function readFile(path) {
  return await fs.readFile(path, 'utf8')
}

export async function writeFile(path, contents) {
  return await fs.writeFile(path, contents)
}
