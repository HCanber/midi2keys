import stripJsonComments from 'strip-json-comments'
import fs from 'node:fs/promises'

export function parseJson(str, { allowComments = true, defaultWhenEmpty = {} } = {}) {
  if (str == null || str.length === 0) return defaultWhenEmpty
  if (allowComments) str = stripJsonComments(str)
  return JSON.parse(str)
}

export async function parseJsonFile(path, options) {
  const contents = await fs.readFile(path, 'utf8')
  return parseJson(contents, options)
}
