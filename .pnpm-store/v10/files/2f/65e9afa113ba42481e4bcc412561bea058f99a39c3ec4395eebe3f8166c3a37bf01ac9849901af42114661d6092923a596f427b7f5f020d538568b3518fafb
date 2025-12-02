import arrayify from 'array-back'
import Column from './column.js'

const _maxWidth = new WeakMap()

/**
 * @module columns
 */

class Columns {
  constructor (columns) {
    this.list = []
    for (const column of arrayify(columns)) {
      this.add(column)
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
    const col = column instanceof Column ? column : new Column(column)
    this.list.push(col)
    return col
  }

  get maxWidth () {
    _maxWidth.get(this)
  }

  set maxWidth (val) {
    _maxWidth.set(this, val)
  }

  /**
   * sets `generatedWidth` for each column
   * @chainable
   */
  autoSize () {
    const maxWidth = _maxWidth.get(this)

    /* size */
    for (const column of this.list) {
      column.generateWidth()
      column.generateMinWidth()
    }

    /* adjust if user set a min or maxWidth */
    for (const column of this.list) {
      if (column.maxWidth !== undefined && column.generatedWidth > column.maxWidth) {
        column.generatedWidth = column.maxWidth
      }

      if (column.minWidth !== undefined && column.generatedWidth < column.minWidth) {
        column.generatedWidth = column.minWidth
      }
    }

    const width = {
      total: this.totalWidth(),
      view: maxWidth,
      diff: this.totalWidth() - maxWidth,
      totalFixed: this.totalFixedWidth(),
      totalResizable: Math.max(maxWidth - this.totalFixedWidth(), 0)
    }

    /* adjust if short of space */
    if (width.diff > 0) {
      /* share the available space between resizeable columns */
      const resizableColumns = this.getResizable()
      for (const column of resizableColumns) {
        column.generatedWidth = Math.floor(width.totalResizable / resizableColumns.length)
      }

      /* at this point, the generatedWidth should never end up bigger than the contentWidth */
      const grownColumns = this.list.filter(column => column.generatedWidth > column.contentWidth)
      const shrunkenColumns = this.list.filter(column => column.generatedWidth < column.contentWidth)
      let salvagedSpace = 0
      for (const column of grownColumns) {
        const currentGeneratedWidth = column.generatedWidth
        column.generateWidth()
        salvagedSpace += currentGeneratedWidth - column.generatedWidth
      }
      for (const column of shrunkenColumns) {
        column.generatedWidth += Math.floor(salvagedSpace / shrunkenColumns.length)
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
    const columns = new Columns()
    for (const row of arrayify(rows)) {
      for (const columnName in row) {
        let column = columns.get(columnName)
        if (!column) {
          /* The default column if not specified */
          column = columns.add({ name: columnName, contentWidth: 0, minContentWidth: 0 })
        }
      }
    }
    return columns
  }
}

export default Columns
