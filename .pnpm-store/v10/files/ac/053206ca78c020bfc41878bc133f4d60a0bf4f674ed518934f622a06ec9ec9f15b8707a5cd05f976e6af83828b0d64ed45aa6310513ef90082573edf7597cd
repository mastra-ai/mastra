import find from '../find.js'
import toJSON from './toJSON.js'
import parseVerb from './parse/index.js'
import toInf from './conjugate/toInfinitive.js'
import toPast from './conjugate/toPast.js'
import toParticiple from './conjugate/toParticiple.js'
import toPresent from './conjugate/toPresent.js'
import toFuture from './conjugate/toFuture.js'
import toGerund from './conjugate/toGerund.js'
import getSubject from './parse/getSubject.js'
import getGrammar from './parse/grammar/index.js'
import toNegative from './conjugate/toNegative.js'
import { getTense } from './lib.js'


const api = function (View) {
  class Verbs extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Verbs'
    }
    parse(n) {
      return this.getNth(n).map(parseVerb)
    }
    json(opts, n) {
      let m = this.getNth(n)
      let arr = m.map(vb => {
        let json = vb.toView().json(opts)[0] || {}
        json.verb = toJSON(vb)
        return json
      }, [])
      return arr
    }
    subjects(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        return getSubject(vb, parsed).subject
      })
    }
    adverbs(n) {
      return this.getNth(n).map(vb => vb.match('#Adverb'))
    }
    isSingular(n) {
      return this.getNth(n).filter(vb => {
        return getSubject(vb).plural !== true
      })
    }
    isPlural(n) {
      return this.getNth(n).filter(vb => {
        return getSubject(vb).plural === true
      })
    }
    isImperative(n) {
      return this.getNth(n).filter(vb => vb.has('#Imperative'))
    }
    toInfinitive(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        return toInf(vb, parsed, info.form)
      })
    }
    toPresentTense(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        if (info.isInfinitive) {
          return vb
        }
        return toPresent(vb, parsed, info.form)
      })
    }
    toPastTense(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        if (info.isInfinitive) {
          return vb
        }
        return toPast(vb, parsed, info.form)
      })
    }
    toFutureTense(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        if (info.isInfinitive) {
          return vb
        }
        return toFuture(vb, parsed, info.form)
      })
    }
    toGerund(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        if (info.isInfinitive) {
          return vb
        }
        return toGerund(vb, parsed, info.form)
      })
    }
    toPastParticiple(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        if (info.isInfinitive) {
          return vb
        }
        return toParticiple(vb, parsed, info.form)
      })
    }
    conjugate(n) {
      const { conjugate, toInfinitive } = this.world.methods.two.transform.verb
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        // allow imperatives like 'go!' to be conjugated here (only)
        if (info.form === 'imperative') {
          info.form = 'simple-present'
        }
        let inf = parsed.root.text('normal')
        if (!parsed.root.has('#Infinitive')) {
          let tense = getTense(parsed.root)
          inf = toInfinitive(inf, vb.model, tense) || inf
        }
        return conjugate(inf, vb.model)
      }, [])
    }

    /** return only verbs with 'not'*/
    isNegative() {
      return this.if('#Negative')
    }
    /**  return only verbs without 'not'*/
    isPositive() {
      return this.ifNo('#Negative')
    }
    /** remove 'not' from these verbs */
    toPositive() {
      let m = this.match('do not #Verb')
      if (m.found) {
        m.remove('do not')
      }
      return this.remove('#Negative')
    }
    toNegative(n) {
      return this.getNth(n).map(vb => {
        let parsed = parseVerb(vb)
        let info = getGrammar(vb, parsed)
        return toNegative(vb, parsed, info.form)
      })
    }
    // overloaded - keep Verb class
    update(pointer) {
      let m = new Verbs(this.document, pointer)
      m._cache = this._cache // share this full thing
      return m
    }
  }
  Verbs.prototype.toPast = Verbs.prototype.toPastTense
  Verbs.prototype.toPresent = Verbs.prototype.toPresentTense
  Verbs.prototype.toFuture = Verbs.prototype.toFutureTense

  View.prototype.verbs = function (n) {
    let vb = find(this)
    vb = vb.getNth(n)
    return new Verbs(this.document, vb.pointer)
  }
}
export default api
