const _value = new WeakMap()
const _column = new WeakMap()

class Cell {
  constructor (value, column) {
    this.value = value
    _column.set(this, column)
  }

  set value (val) {
    _value.set(this, val)
  }

  /**
  * Must return a string or object with a `.toString()` method.
  * @returns {string}
  */
  get value () {
    let cellValue = _value.get(this)
    const column = _column.get(this)
    if (column.get) {
      cellValue = column.get(cellValue)
    }
    if (cellValue === undefined) {
      cellValue = ''
    } else {
      cellValue = String(cellValue)
    }
    return cellValue
  }
}

export default Cell
