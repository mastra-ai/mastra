/**
 * Takes any input and guarantees an array back.
 *
 * - Converts array-like objects (e.g. `arguments`, `Set`) to a real array.
 * - Converts `undefined` to an empty array.
 * - Converts any another other, singular value (including `null`, objects and iterables other than `Set`) into an array containing that value.
 * - Ignores input which is already an array.
 *
 * @module array-back
 * @example
 * > const arrayify = require('array-back')
 *
 * > arrayify(undefined)
 * []
 *
 * > arrayify(null)
 * [ null ]
 *
 * > arrayify(0)
 * [ 0 ]
 *
 * > arrayify([ 1, 2 ])
 * [ 1, 2 ]
 *
 * > arrayify(new Set([ 1, 2 ]))
 * [ 1, 2 ]
 *
 * > function f(){ return arrayify(arguments); }
 * > f(1,2,3)
 * [ 1, 2, 3 ]
 */

function isObject (input) {
  return typeof input === 'object' && input !== null
}

function isArrayLike (input) {
  return isObject(input) && typeof input.length === 'number'
}

/**
 * @param {*} - The input value to convert to an array
 * @returns {Array}
 * @alias module:array-back
 */
function arrayify (input) {
  if (Array.isArray(input)) {
    return input
  } else if (input === undefined) {
    return []
  } else if (isArrayLike(input) || input instanceof Set) {
    return Array.from(input)
  } else {
    return [input]
  }
}

const _value = new WeakMap();
const _column = new WeakMap();

class Cell {
  constructor (value, column) {
    this.value = value;
    _column.set(this, column);
  }

  set value (val) {
    _value.set(this, val);
  }

  /**
  * Must return a string or object with a `.toString()` method.
  * @returns {string}
  */
  get value () {
    let cellValue = _value.get(this);
    const column = _column.get(this);
    if (column.get) {
      cellValue = column.get(cellValue);
    }
    if (cellValue === undefined) {
      cellValue = '';
    } else {
      cellValue = String(cellValue);
    }
    return cellValue
  }
}

/**
 * @module rows
 */

/**
≈ Each row is a map of column/cell pairs.
*/
class Rows {
  constructor (rows, columns) {
    this.list = [];
    this.load(rows, columns);
  }

  load (rows, columns) {
    for (const row of arrayify(rows)) {
      const map = new Map(columns.list.map(column => [column, new Cell(row[column.name], column)]));
      this.list.push(map);
    }
  }
}

/**
 * @module padding
 */

class Padding {
  constructor (padding) {
    this.left = padding.left;
    this.right = padding.right;
  }

  length () {
    return this.left.length + this.right.length
  }
}

/**
 * @module column
 */

const _padding = new WeakMap();

// setting any column property which is a factor of the width should trigger autoSize()

/**
 * Represents the configuration and generatedWidth for a table column.
 */
class Column {
  constructor (column = {}) {
    this.name = column.name;
    this.width = column.width;
    this.maxWidth = column.maxWidth;
    this.minWidth = column.minWidth;
    this.noWrap = column.noWrap;
    this.break = column.break;
    this.contentWrappable = column.contentWrappable;
    this.contentWidth = column.contentWidth;
    this.minContentWidth = column.minContentWidth;
    // this.get = column.get
    this.padding = column.padding || { left: ' ', right: ' ' };
    this.generatedWidth = null;
  }

  set padding (padding) {
    _padding.set(this, new Padding(padding));
  }

  get padding () {
    return _padding.get(this)
  }

  /**
   * The width of the content (excluding padding) after being wrapped
   */
  get wrappedContentWidth () {
    return Math.max(this.generatedWidth - this.padding.length(), 0)
  }

  isResizable () {
    return !this.isFixed()
  }

  isFixed () {
    return this.width !== undefined || this.noWrap || !this.contentWrappable
  }

  generateWidth () {
    this.generatedWidth = this.width || (this.contentWidth + this.padding.length());
  }

  generateMinWidth () {
    this.minWidth = this.minContentWidth + this.padding.length();
  }
}

const _maxWidth = new WeakMap();

/**
 * @module columns
 */

class Columns {
  constructor (columns) {
    this.list = [];
    for (const column of arrayify(columns)) {
      this.add(column);
    }
  }

  /**
   * sum of all generatedWidth fields
   * @return {number}
   */
  totalWidth () {
    return this.list.length
      ? this.list.map(col => col.generatedWidth).reduce((a, b) => a + b)
      : 0
  }

  totalFixedWidth () {
    return this.getFixed()
      .map(col => col.generatedWidth)
      .reduce((a, b) => a + b, 0)
  }

  get (columnName) {
    return this.list.find(column => column.name === columnName)
  }

  getResizable () {
    return this.list.filter(column => column.isResizable())
  }

  getFixed () {
    return this.list.filter(column => column.isFixed())
  }

  add (column) {
    const col = column instanceof Column ? column : new Column(column);
    this.list.push(col);
    return col
  }

  get maxWidth () {
    _maxWidth.get(this);
  }

  set maxWidth (val) {
    _maxWidth.set(this, val);
  }

  /**
   * sets `generatedWidth` for each column
   * @chainable
   */
  autoSize () {
    const maxWidth = _maxWidth.get(this);

    /* size */
    for (const column of this.list) {
      column.generateWidth();
      column.generateMinWidth();
    }

    /* adjust if user set a min or maxWidth */
    for (const column of this.list) {
      if (column.maxWidth !== undefined && column.generatedWidth > column.maxWidth) {
        column.generatedWidth = column.maxWidth;
      }

      if (column.minWidth !== undefined && column.generatedWidth < column.minWidth) {
        column.generatedWidth = column.minWidth;
      }
    }

    const width = {
      total: this.totalWidth(),
      view: maxWidth,
      diff: this.totalWidth() - maxWidth,
      totalFixed: this.totalFixedWidth(),
      totalResizable: Math.max(maxWidth - this.totalFixedWidth(), 0)
    };

    /* adjust if short of space */
    if (width.diff > 0) {
      /* share the available space between resizeable columns */
      const resizableColumns = this.getResizable();
      for (const column of resizableColumns) {
        column.generatedWidth = Math.floor(width.totalResizable / resizableColumns.length);
      }

      /* at this point, the generatedWidth should never end up bigger than the contentWidth */
      const grownColumns = this.list.filter(column => column.generatedWidth > column.contentWidth);
      const shrunkenColumns = this.list.filter(column => column.generatedWidth < column.contentWidth);
      let salvagedSpace = 0;
      for (const column of grownColumns) {
        const currentGeneratedWidth = column.generatedWidth;
        column.generateWidth();
        salvagedSpace += currentGeneratedWidth - column.generatedWidth;
      }
      for (const column of shrunkenColumns) {
        column.generatedWidth += Math.floor(salvagedSpace / shrunkenColumns.length);
      }

    /* if, after autosizing, we still don't fit within maxWidth then give up */
    }

    return this
  }

  /**
   * Factory method returning all distinct columns from input
   * @param  {object[]} - input recordset
   * @return {module:columns}
   */
  static getColumns (rows) {
    const columns = new Columns();
    for (const row of arrayify(rows)) {
      for (const columnName in row) {
        let column = columns.get(columnName);
        if (!column) {
          /* The default column if not specified */
          column = columns.add({ name: columnName, contentWidth: 0, minContentWidth: 0 });
        }
      }
    }
    return columns
  }
}

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

      /* split each line into an array of chunks, else mark it empty */
      .map(line => line.match(re.chunk) || ['~~empty~~'])

      /* optionally, break each word on the line into pieces */
      .map(lineWords => this.options.break
        ? lineWords.map(breakWord, this)
        : lineWords
      )
      .map(lineWords => lineWords.flat())

      /* transforming the line of words to one or more new lines wrapped to size */
      .map(lineWords => {
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
      .map(trimLine, this)

      /* filter out empty lines */
      .filter(line => line.trim())

      /* restore the user's original empty lines */
      .map(line => line.replace('~~empty~~', ''))
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

/**
 * @module ansi
 */

const ansiEscapeSequence = /\u001b.*?m/g;

function remove (input) {
  return input.replace(ansiEscapeSequence, '')
}

function has (input) {
  return ansiEscapeSequence.test(input)
}

/**
 * Array of arrays in.. Returns the length of the longest one
 * @returns {number}
 * @private
 */
function getLongestArray (arrays) {
  const lengths = arrays.map(array => array.length);
  return Math.max(...lengths)
}

function padCell (cellValue, padding, width) {
  const ansiLength = cellValue.length - remove(cellValue).length;
  cellValue = cellValue || '';
  return (padding.left || '') +
  cellValue.padEnd(width - padding.length() + ansiLength) + (padding.right || '')
}

function getLongestWord (line) {
  const words = Wordwrap.getChunks(line);
  return words.reduce((max, word) => Math.max(word.length, max), 0)
}

function removeEmptyColumns (data) {
  const distinctColumnNames = data.reduce((columnNames, row) => {
    for (const key of Object.keys(row)) {
      if (!columnNames.includes(key)) {
        columnNames.push(key);
      }
    }
    return columnNames
  }, []);

  const emptyColumns = distinctColumnNames.filter(columnName => {
    const hasValue = data.some(row => {
      const value = row[columnName];
      return (value !== undefined && typeof value !== 'string') || (typeof value === 'string' && /\S+/.test(value))
    });
    return !hasValue
  });

  return data.map(row => {
    for (const emptyCol of emptyColumns) {
      delete row[emptyCol];
    }
    return row
  })
}

function applyDefaultValues (options = {}, defaults = {}) {
  /* Take a shallow copy of the supplied options */
  const result = Object.assign({}, options);
  /* Apply default values as required */
  if (typeof result.padding === 'object') {
    if (result.padding.left === undefined) result.padding.left = defaults.padding.left;
    if (result.padding.right === undefined) result.padding.right = defaults.padding.right;
  } else {
    result.padding = defaults.padding;
  }
  if (result.maxWidth === undefined) result.maxWidth = defaults.maxWidth;
  if (result.columns === undefined) result.columns = defaults.columns;
  if (result.eol === undefined) result.eol = defaults.eol;
  return result
}

/**
 * @module table-layout
 */

/**
 * Recordset data in (array of objects), text table out.
 * @alias module:table-layout
 */
class Table {
  /**
   * @param {object[]} - input data
   * @param [options] {object} - optional settings
   * @param [options.maxWidth] {number} - maximum width of layout
   * @param [options.noWrap] {boolean} - disable wrapping on all columns
   * @param [options.noTrim] {boolean} - disable line-trimming
   * @param [options.break] {boolean} - enable word-breaking on all columns
   * @param [options.columns] {module:table-layout~columnOption} - array of column-specific options
   * @param [options.ignoreEmptyColumns] {boolean} - If set, empty columns or columns containing only whitespace are not rendered.
   * @param [options.padding] {object} - Padding values to set on each column. Per-column overrides can be set in the `options.columns` array.
   * @param [options.padding.left] {string} - Defaults to a single space.
   * @param [options.padding.right] {string} - Defaults to a single space.
   * @param [options.eol] {string} - EOL character used. Defaults to `\n`.
   * @alias module:table-layout
   */
  constructor (data, options = {}) {
    const defaults = {
      padding: {
        left: ' ',
        right: ' '
      },
      maxWidth: 80,
      columns: [],
      eol: '\n'
    };
    this.options = applyDefaultValues(options, defaults);
    this.rows = null;
    this.columns = null;
    this.load(data);
  }

  /**
  * Set the input data to display. Must be an array of objects.
  * @param data {object[]}
  */
  load (data) {
    const options = this.options;

    /* remove empty columns */
    if (options.ignoreEmptyColumns) {
      data = removeEmptyColumns(data);
    }

    /* Create columns.. also removes ansi characters and measures column content width */
    this.columns = Columns.getColumns(data);

    /* load default column properties from options */
    this.columns.maxWidth = options.maxWidth;
    for (const column of this.columns.list) {
      column.padding = options.padding;
      column.noWrap = options.noWrap;
      column.break = options.break;
      if (options.break) {
        /* Force column to be wrappable */
        column.contentWrappable = true;
      }
    }

    /* load column properties from options.columns */
    for (const optionColumn of options.columns) {
      const column = this.columns.get(optionColumn.name);
      if (column) {
        if (optionColumn.padding) {
          column.padding.left = optionColumn.padding.left;
          column.padding.right = optionColumn.padding.right;
        }
        column.width = optionColumn.width;
        column.maxWidth = optionColumn.maxWidth;
        column.minWidth = optionColumn.minWidth;
        column.noWrap = optionColumn.noWrap;
        column.break = optionColumn.break;

        if (optionColumn.break) {
          /* Force column to be wrappable */
          column.contentWrappable = true;
        }

        column.get = optionColumn.get;
      }
    }

    for (const row of arrayify(data)) {
      for (const columnName in row) {
        const column = this.columns.get(columnName);

        /* Remove ansi characters from cell value before calculating widths */
        const cell = new Cell(row[columnName], column);
        let cellValue = cell.value;
        if (has(cellValue)) {
          cellValue = remove(cellValue);
        }

        /* Update column content width if this if this cell is wider */
        if (cellValue.length > column.contentWidth) {
          column.contentWidth = cellValue.length;
        }

        /* Update column minContentWidth if this cell has a longer word */
        const longestWord = getLongestWord(cellValue);
        if (longestWord > column.minContentWidth) {
          column.minContentWidth = longestWord;
        }
        if (!column.contentWrappable) {
          column.contentWrappable = Wordwrap.isWrappable(cellValue);
        }
      }
    }

    this.columns.autoSize();
    this.rows = new Rows(data, this.columns);
    return this
  }

  getWrapped () {
    this.columns.autoSize();
    return this.rows.list.map(row => {
      const line = [];
      for (const [column, cell] of row.entries()) {
        if (column.noWrap) {
          line.push(cell.value.split(/\r\n?|\n/));
        } else {
          line.push(Wordwrap.lines(cell.value, {
            width: column.wrappedContentWidth,
            break: column.break,
            noTrim: this.options.noTrim
          }));
        }
      }
      return line
    })
  }

  getLines () {
    const wrappedLines = this.getWrapped();
    const lines = [];
    wrappedLines.forEach(wrapped => {
      const mostLines = getLongestArray(wrapped);
      for (let i = 0; i < mostLines; i++) {
        const line = [];
        wrapped.forEach(cell => {
          line.push(cell[i] || '');
        });
        lines.push(line);
      }
    });
    return lines
  }

  /**
   * Identical to `.toString()` with the exception that the result will be an array of lines, rather than a single, multi-line string.
   * @returns {string[]}
   */
  renderLines () {
    const lines = this.getLines();
    return lines.map(line => {
      return line.reduce((prev, cell, index) => {
        const column = this.columns.list[index];
        return prev + padCell(cell, column.padding, column.generatedWidth)
      }, '')
    })
  }

  /**
   * Returns the input data as a text table.
   * @returns {string}
   */
  toString () {
    return this.renderLines().join(this.options.eol) + this.options.eol
  }
}

export { Table as default };
