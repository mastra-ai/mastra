import find from './find.js'
import parse from './parse.js'
import toCardinal from './convert/toCardinal.js'
import toOrdinal from './convert/toOrdinal.js'

const plugin = function (View) {
  /**
   */
  class Fractions extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Fractions'
    }
    parse(n) {
      return this.getNth(n).map(parse)
    }
    get(n) {
      return this.getNth(n).map(parse)
    }
    json(n) {
      return this.getNth(n).map(p => {
        let json = p.toView().json(n)[0]
        let parsed = parse(p)
        json.fraction = parsed
        return json
      }, [])
    }
    // become 0.5
    toDecimal(n) {
      this.getNth(n).forEach(m => {
        let { decimal } = parse(m)
        m = m.replaceWith(String(decimal), true)
        m.tag('NumericValue')
        m.unTag('Fraction')
      })
      return this
    }
    toFraction(n) {
      this.getNth(n).forEach(m => {
        let obj = parse(m)
        if (obj && typeof obj.numerator === 'number' && typeof obj.denominator === 'number') {
          let str = `${obj.numerator}/${obj.denominator}`
          this.replace(m, str)
        }
      })
      return this
    }
    toOrdinal(n) {
      this.getNth(n).forEach(m => {
        let obj = parse(m)
        let str = toOrdinal(obj)
        if (m.after('^#Noun').found) {
          str += ' of' // three fifths of dentists
        }
        m.replaceWith(str)
      })
      return this
    }
    toCardinal(n) {
      this.getNth(n).forEach(m => {
        let obj = parse(m)
        let str = toCardinal(obj)
        m.replaceWith(str)
      })
      return this
    }
    toPercentage(n) {
      this.getNth(n).forEach(m => {
        let { decimal } = parse(m)
        let percent = decimal * 100
        percent = Math.round(percent * 100) / 100 // round it
        m.replaceWith(`${percent}%`)
      })
      return this
    }
  }

  View.prototype.fractions = function (n) {
    let m = find(this)
    m = m.getNth(n)
    return new Fractions(this.document, m.pointer)
  }
}

export default plugin
