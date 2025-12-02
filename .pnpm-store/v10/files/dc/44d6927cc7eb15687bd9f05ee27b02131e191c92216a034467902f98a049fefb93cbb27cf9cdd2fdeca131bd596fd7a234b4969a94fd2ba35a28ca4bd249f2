import find from './find.js'
import parse from './parse/index.js'
import format from './format/index.js'
import isUnit from './isUnit.js'

const addMethod = function (View) {
  /**   */
  class Numbers extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Numbers'
    }
    parse(n) {
      return this.getNth(n).map(parse)
    }
    get(n) {
      return this.getNth(n)
        .map(parse)
        .map(o => o.num)
    }
    json(n) {
      let opts = typeof n === 'object' ? n : {}
      return this.getNth(n).map(p => {
        let json = p.toView().json(opts)[0]
        let parsed = parse(p)
        json.number = {
          prefix: parsed.prefix,
          num: parsed.num,
          suffix: parsed.suffix,
          hasComma: parsed.hasComma,
          unit: parsed.unit,
        }
        return json
      }, [])
    }
    /** any known measurement unit, for the number */
    units() {
      return this.growRight('#Unit').match('#Unit$')
    }
    /** return values that match a given unit */
    isUnit(allowed) {
      return isUnit(this, allowed)
    }
    /** return only ordinal numbers */
    isOrdinal() {
      return this.if('#Ordinal')
    }
    /** return only cardinal numbers*/
    isCardinal() {
      return this.if('#Cardinal')
    }

    /** convert to numeric form like '8' or '8th' */
    toNumber() {
      let res = this.map(val => {
        if (!this.has('#TextValue')) {
          return val
        }
        let obj = parse(val)
        if (obj.num === null) {
          return val
        }
        let fmt = val.has('#Ordinal') ? 'Ordinal' : 'Cardinal'
        let str = format(obj, fmt)
        val.replaceWith(str, { tags: true })
        return val.tag('NumericValue')
      })
      return new Numbers(res.document, res.pointer)
    }
    /** add commas, or nicer formatting for numbers */
    toLocaleString() {
      let m = this
      m.forEach(val => {
        let obj = parse(val)
        if (obj.num === null) {
          return
        }
        let num = obj.num.toLocaleString()
        // support ordinal ending, too
        if (val.has('#Ordinal')) {
          let str = format(obj, 'Ordinal')
          let end = str.match(/[a-z]+$/)
          if (end) {
            num += end[0] || ''
          }
        }
        val.replaceWith(num, { tags: true })
      })
      return this
    }
    /** convert to numeric form like 'eight' or 'eighth' */
    toText() {
      let m = this
      let res = m.map(val => {
        if (val.has('#TextValue')) {
          return val
        }
        let obj = parse(val)
        if (obj.num === null) {
          return val
        }
        let fmt = val.has('#Ordinal') ? 'TextOrdinal' : 'TextCardinal'
        let str = format(obj, fmt)
        val.replaceWith(str, { tags: true })
        val.tag('TextValue')
        return val
      })
      return new Numbers(res.document, res.pointer)
    }
    /** convert ordinal to cardinal form, like 'eight', or '8' */
    toCardinal() {
      let m = this
      let res = m.map(val => {
        if (!val.has('#Ordinal')) {
          return val
        }
        let obj = parse(val)
        if (obj.num === null) {
          return val
        }
        let fmt = val.has('#TextValue') ? 'TextCardinal' : 'Cardinal'
        let str = format(obj, fmt)
        val.replaceWith(str, { tags: true })
        val.tag('Cardinal')
        return val
      })
      return new Numbers(res.document, res.pointer)
    }
    /** convert cardinal to ordinal form, like 'eighth', or '8th' */
    toOrdinal() {
      let m = this
      let res = m.map(val => {
        if (val.has('#Ordinal')) {
          return val
        }
        let obj = parse(val)
        if (obj.num === null) {
          return val
        }
        let fmt = val.has('#TextValue') ? 'TextOrdinal' : 'Ordinal'
        let str = format(obj, fmt)
        val.replaceWith(str, { tags: true })
        val.tag('Ordinal')
        return val
      })
      return new Numbers(res.document, res.pointer)
    }

    /** return only numbers that are == n */
    isEqual(n) {
      return this.filter(val => {
        let num = parse(val).num
        return num === n
      })
    }
    /** return only numbers that are > n*/
    greaterThan(n) {
      return this.filter(val => {
        let num = parse(val).num
        return num > n
      })
    }
    /** return only numbers that are < n*/
    lessThan(n) {
      return this.filter(val => {
        let num = parse(val).num
        return num < n
      })
    }
    /** return only numbers > min and < max */
    between(min, max) {
      return this.filter(val => {
        let num = parse(val).num
        return num > min && num < max
      })
    }
    /** set these number to n */
    set(n) {
      if (n === undefined) {
        return this // don't bother
      }
      if (typeof n === 'string') {
        n = parse(n).num
      }
      let m = this
      let res = m.map(val => {
        let obj = parse(val)
        obj.num = n
        if (obj.num === null) {
          return val
        }
        let fmt = val.has('#Ordinal') ? 'Ordinal' : 'Cardinal'
        if (val.has('#TextValue')) {
          fmt = val.has('#Ordinal') ? 'TextOrdinal' : 'TextCardinal'
        }
        let str = format(obj, fmt)
        // add commas to number
        if (obj.hasComma && fmt === 'Cardinal') {
          str = Number(str).toLocaleString()
        }
        val = val.not('#Currency')
        val.replaceWith(str, { tags: true })
        // handle plural/singular unit
        // agreeUnits(agree, val, obj)
        return val
      })
      return new Numbers(res.document, res.pointer)
    }
    add(n) {
      if (!n) {
        return this // don't bother
      }
      if (typeof n === 'string') {
        n = parse(n).num
      }
      let m = this
      let res = m.map(val => {
        let obj = parse(val)
        if (obj.num === null) {
          return val
        }
        obj.num += n
        let fmt = val.has('#Ordinal') ? 'Ordinal' : 'Cardinal'
        if (obj.isText) {
          fmt = val.has('#Ordinal') ? 'TextOrdinal' : 'TextCardinal'
        }
        let str = format(obj, fmt)
        val.replaceWith(str, { tags: true })
        // handle plural/singular unit
        // agreeUnits(agree, val, obj)
        return val
      })
      return new Numbers(res.document, res.pointer)
    }
    /** decrease each number by n*/
    subtract(n, agree) {
      return this.add(n * -1, agree)
    }
    /** increase each number by 1 */
    increment(agree) {
      return this.add(1, agree)
    }
    /** decrease each number by 1 */
    decrement(agree) {
      return this.add(-1, agree)
    }
    // overloaded - keep Numbers class
    update(pointer) {
      let m = new Numbers(this.document, pointer)
      m._cache = this._cache // share this full thing
      return m
    }
  }
  // aliases
  Numbers.prototype.toNice = Numbers.prototype.toLocaleString
  Numbers.prototype.isBetween = Numbers.prototype.between
  Numbers.prototype.minus = Numbers.prototype.subtract
  Numbers.prototype.plus = Numbers.prototype.add
  Numbers.prototype.equals = Numbers.prototype.isEqual

  View.prototype.numbers = function (n) {
    let m = find(this)
    m = m.getNth(n)
    return new Numbers(this.document, m.pointer)
  }
  View.prototype.percentages = function (n) {
    let m = find(this)
    m = m.filter(v => v.has('#Percent') || v.after('^percent'))
    m = m.getNth(n)
    return new Numbers(this.document, m.pointer)
  }
  View.prototype.money = function (n) {
    let m = find(this)
    m = m.filter(v => v.has('#Money') || v.after('^#Currency'))
    m = m.getNth(n)
    return new Numbers(this.document, m.pointer)
  }
  // alias
  View.prototype.values = View.prototype.numbers
}
export default addMethod
