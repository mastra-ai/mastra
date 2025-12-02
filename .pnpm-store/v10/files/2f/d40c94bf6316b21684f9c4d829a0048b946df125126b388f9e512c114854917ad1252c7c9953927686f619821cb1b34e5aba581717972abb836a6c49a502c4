/**
 * @module ansi
 */

const ansiEscapeSequence = /\u001b.*?m/g

function remove (input) {
  return input.replace(ansiEscapeSequence, '')
}

function has (input) {
  return ansiEscapeSequence.test(input)
}

export { remove, has }
