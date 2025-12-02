import isQuestion from './questions.js'
import parse from './parse/index.js'
import toPast from './conjugate/toPast.js'
import toPresent from './conjugate/toPresent.js'
import toFuture from './conjugate/toFuture.js'
import { toNegative, toPositive } from './conjugate/toNegative.js'
import toInfinitive from './conjugate/toInfinitive.js'

const api = function (View) {
  class Sentences extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Sentences'
    }
    json(opts = {}) {
      return this.map(m => {
        let json = m.toView().json(opts)[0] || {}
        let { subj, verb, pred, grammar } = parse(m)
        json.sentence = {
          subject: subj.text('normal'),
          verb: verb.text('normal'),
          predicate: pred.text('normal'),
          grammar
        }
        return json
      }, [])
    }
    toPastTense(n) {
      return this.getNth(n).map(s => {
        let parsed = parse(s)
        return toPast(s, parsed)
      })
    }
    toPresentTense(n) {
      return this.getNth(n).map(s => {
        let parsed = parse(s)
        return toPresent(s, parsed)
      })
    }
    toFutureTense(n) {
      return this.getNth(n).map(s => {
        let parsed = parse(s)
        s = toFuture(s, parsed)
        return s
      })
    }
    toInfinitive(n) {
      return this.getNth(n).map(s => {
        let parsed = parse(s)
        return toInfinitive(s, parsed)
      })
    }
    toNegative(n) {
      return this.getNth(n).map(vb => {
        let parsed = parse(vb)
        return toNegative(vb, parsed)
      })
    }
    toPositive(n) {
      return this.getNth(n).map(vb => {
        let parsed = parse(vb)
        return toPositive(vb, parsed)
      })
    }
    isQuestion(n) {
      return this.questions(n)
    }
    isExclamation(n) {
      let res = this.filter(s => s.lastTerm().has('@hasExclamation'))
      return res.getNth(n)
    }
    isStatement(n) {
      let res = this.filter(s => !s.isExclamation().found && !s.isQuestion().found)
      return res.getNth(n)
    }
    // overloaded - keep Sentences class
    update(pointer) {
      let m = new Sentences(this.document, pointer)
      m._cache = this._cache // share this full thing
      return m
    }
  }
  // aliases
  Sentences.prototype.toPresent = Sentences.prototype.toPresentTense
  Sentences.prototype.toPast = Sentences.prototype.toPastTense
  Sentences.prototype.toFuture = Sentences.prototype.toFutureTense

  const methods = {
    sentences: function (n) {
      let m = this.map(s => s.fullSentence())
      m = m.getNth(n)
      return new Sentences(this.document, m.pointer)
    },
    questions: function (n) {
      let m = isQuestion(this)
      return m.getNth(n)
    },
  }

  Object.assign(View.prototype, methods)
}
export default api
