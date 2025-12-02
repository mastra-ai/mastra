import { remove } from './ansi.js'
import wrap from 'wordwrapjs'

/**
 * Array of arrays in.. Returns the length of the longest one
 * @returns {number}
 * @private
 */
function getLongestArray (arrays) {
  const lengths = arrays.map(array => array.length)
  return Math.max(...lengths)
}

function padCell (cellValue, padding, width) {
  const ansiLength = cellValue.length - remove(cellValue).length
  cellValue = cellValue || ''
  return (padding.left || '') +
  cellValue.padEnd(width - padding.length() + ansiLength) + (padding.right || '')
}

function getLongestWord (line) {
  const words = wrap.getChunks(line)
  return words.reduce((max, word) => Math.max(word.length, max), 0)
}

function removeEmptyColumns (data) {
  const distinctColumnNames = data.reduce((columnNames, row) => {
    for (const key of Object.keys(row)) {
      if (!columnNames.includes(key)) {
        columnNames.push(key)
      }
    }
    return columnNames
  }, [])

  const emptyColumns = distinctColumnNames.filter(columnName => {
    const hasValue = data.some(row => {
      const value = row[columnName]
      return (value !== undefined && typeof value !== 'string') || (typeof value === 'string' && /\S+/.test(value))
    })
    return !hasValue
  })

  return data.map(row => {
    for (const emptyCol of emptyColumns) {
      delete row[emptyCol]
    }
    return row
  })
}

function applyDefaultValues (options = {}, defaults = {}) {
  /* Take a shallow copy of the supplied options */
  const result = Object.assign({}, options)
  /* Apply default values as required */
  if (typeof result.padding === 'object') {
    if (result.padding.left === undefined) result.padding.left = defaults.padding.left
    if (result.padding.right === undefined) result.padding.right = defaults.padding.right
  } else {
    result.padding = defaults.padding
  }
  if (result.maxWidth === undefined) result.maxWidth = defaults.maxWidth
  if (result.columns === undefined) result.columns = defaults.columns
  if (result.eol === undefined) result.eol = defaults.eol
  return result
}

export { getLongestArray, padCell, getLongestWord, removeEmptyColumns, applyDefaultValues }
