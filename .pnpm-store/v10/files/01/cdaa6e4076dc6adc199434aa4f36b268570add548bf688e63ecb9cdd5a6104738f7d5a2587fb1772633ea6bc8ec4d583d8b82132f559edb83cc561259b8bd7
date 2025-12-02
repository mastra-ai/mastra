import arrayify from 'array-back'
import Cell from './cell.js'

/**
 * @module rows
 */

/**
≈ Each row is a map of column/cell pairs.
*/
class Rows {
  constructor (rows, columns) {
    this.list = []
    this.load(rows, columns)
  }

  load (rows, columns) {
    for (const row of arrayify(rows)) {
      const map = new Map(columns.list.map(column => [column, new Cell(row[column.name], column)]))
      this.list.push(map)
    }
  }
}

export default Rows
