import Padding from './padding.js'

/**
 * @module column
 */

const _padding = new WeakMap()

// setting any column property which is a factor of the width should trigger autoSize()

/**
 * Represents the configuration and generatedWidth for a table column.
 */
class Column {
  constructor (column = {}) {
    this.name = column.name
    this.width = column.width
    this.maxWidth = column.maxWidth
    this.minWidth = column.minWidth
    this.noWrap = column.noWrap
    this.break = column.break
    this.contentWrappable = column.contentWrappable
    this.contentWidth = column.contentWidth
    this.minContentWidth = column.minContentWidth
    // this.get = column.get
    this.padding = column.padding || { left: ' ', right: ' ' }
    this.generatedWidth = null
  }

  set padding (padding) {
    _padding.set(this, new Padding(padding))
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
    this.generatedWidth = this.width || (this.contentWidth + this.padding.length())
  }

  generateMinWidth () {
    this.minWidth = this.minContentWidth + this.padding.length()
  }
}

export default Column
