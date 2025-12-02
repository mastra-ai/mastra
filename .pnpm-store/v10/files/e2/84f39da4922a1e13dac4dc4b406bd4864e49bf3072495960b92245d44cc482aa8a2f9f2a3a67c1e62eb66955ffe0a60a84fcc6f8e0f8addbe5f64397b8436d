'use strict';

/**
 * @module wordwrapjs
 */

/**
 * Wordwrap options.
 * @typedef {Object} WordwrapOptions
 * @property {number} [width=30] - The max column width in characters.
 * @property {boolean} [break=false] - If true, words exceeding the specified `width` will be forcefully broken
 * @property {boolean} [noTrim=false] - By default, each line output is trimmed. If `noTrim` is set, no line-trimming occurs - all whitespace from the input text is left in.
 * @property {string} [eol='\n'] - The end of line character to use. Defaults to `\n`.
 */

const re = {
  chunk: /[^\s-]+?-\b|\S+|\s+|\r\n?|\n/g,
  ansiEscapeSequence: /\u001b.*?m/g
};

const EMPTY_LINE = Symbol('emptyLine');

/**
 * @alias module:wordwrapjs
 * @typicalname wordwrap
 */
class Wordwrap {
  /**
   * @param {string} text - The input text to wrap.
   * @param {module:wordwrapjs~WordwrapOptions} [options]
   */
  constructor (text = '', options = {}) {
    this._lines = String(text).split(/\r\n|\n/g);
    this.options = {
      eol: '\n',
      width: 30,
      ...options
    };
  }

  lines () {
    /* trim each line of the supplied text */
    return this._lines.map(trimLine, this)

      /* split each line into an array of chunks, else mark it empty with a symbol */
      .map(line => {
        const chunks = line.match(re.chunk);
        return chunks && chunks.length ? chunks : [EMPTY_LINE]
      })

      /* optionally, break each word on the line into pieces */
      .map(lineWords => this.options.break
        ? lineWords.map(breakWord, this)
        : lineWords
      )
      .map(lineWords => lineWords.flat())

      /* transforming the line of words to one or more new lines wrapped to size */
      .map(lineWords => {
        /* if the line is the EMPTY_LINE symbol, preserve it */
        if (lineWords.length === 1 && lineWords[0] === EMPTY_LINE) {
          return lineWords
        }

        return lineWords
          .reduce((lines, word) => {
            const currentLine = lines[lines.length - 1];
            if (replaceAnsi(word).length + replaceAnsi(currentLine).length > this.options.width) {
              lines.push(word);
            } else {
              lines[lines.length - 1] += word;
            }
            return lines
          }, [''])
      })
      .flat()

      /* trim the wrapped lines */
      .map(line => (line === EMPTY_LINE ? '' : trimLine.call(this, line)))

      /* filter out empty lines except those that were originally empty */
      .filter((line, idx) => {
        return line !== ''
          || this._lines[idx] === ''
          || (typeof this._lines[idx] !== 'undefined' && this._lines[idx].match(/^\s*$/))
      })
  }

  wrap () {
    return this.lines().join(this.options.eol)
  }

  toString () {
    return this.wrap()
  }

  /**
   * @param {string} text - the input text to wrap
   * @param {module:wordwrapjs~WordwrapOptions} [options]
   */
  static wrap (text, options) {
    const block = new this(text, options);
    return block.wrap()
  }

  /**
   * Wraps the input text, returning an array of strings (lines).
   * @param {string} text - input text
   * @param {module:wordwrapjs~WordwrapOptions} [options]
   */
  static lines (text, options) {
    const block = new this(text, options);
    return block.lines()
  }

  /**
   * Returns true if the input text would be wrapped if passed into `.wrap()`.
   * @param {string} text - input text
   * @return {boolean}
   */
  static isWrappable (text = '') {
    const matches = String(text).match(re.chunk);
    return matches ? matches.length > 1 : false
  }

  /**
   * Splits the input text into an array of words and whitespace.
   * @param {string} text - input text
   * @returns {string[]}
   */
  static getChunks (text) {
    return text.match(re.chunk) || []
  }
}

function trimLine (line) {
  return this.options.noTrim ? line : line.trim()
}

function replaceAnsi (string) {
  return string.replace(re.ansiEscapeSequence, '')
}

/**
 * break a word into several pieces
 * @param {string} word
 * @private
 */
function breakWord (word) {
  if (word === EMPTY_LINE) {
    return word
  }

  if (replaceAnsi(word).length > this.options.width) {
    const letters = word.split('');
    let piece;
    const pieces = [];
    while ((piece = letters.splice(0, this.options.width)).length) {
      pieces.push(piece.join(''));
    }
    return pieces
  } else {
    return word
  }
}

module.exports = Wordwrap;
