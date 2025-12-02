import find from '../find.js'
import parseNoun from './parse.js'
import toJSON from './toJSON.js'
import toPlural from './toPlural.js'
import hasPlural from './hasPlural.js'
import toSingular from './toSingular.js'

const api = function (View) {
  class Nouns extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Nouns'
    }

    parse(n) {
      return this.getNth(n).map(parseNoun)
    }

    json(n) {
      let opts = typeof n === 'object' ? n : {}
      return this.getNth(n).map(m => {
        let json = m.toView().json(opts)[0] || {}
        if (opts && opts.noun !== false) {
          json.noun = toJSON(m)
        }
        return json
      }, [])
    }
    conjugate(n) {
      const methods = this.world.methods.two.transform.noun
      return this.getNth(n).map(m => {
        let parsed = parseNoun(m)
        let root = parsed.root.compute('root').text('root')
        let res = {
          Singular: root,
        }
        if (hasPlural(parsed.root)) {
          res.Plural = methods.toPlural(root, this.model)
        }
        // only show plural if one exists
        if (res.Singular === res.Plural) {
          delete res.Plural
        }
        return res
      }, [])
    }
    isPlural(n) {
      let res = this.filter(m => parseNoun(m).isPlural)
      return res.getNth(n)
    }

    isSingular(n) {
      let res = this.filter(m => !parseNoun(m).isPlural)
      return res.getNth(n)
    }

    adjectives(n) {
      let res = this.update([])
      this.forEach(m => {
        let adj = parseNoun(m).adjectives
        if (adj.found) {
          res = res.concat(adj)
        }
      })
      return res.getNth(n)
    }

    toPlural(n) {
      return this.getNth(n).map(m => {
        return toPlural(m, parseNoun(m))
      })
      // return new Nouns(all.document, all.pointer)
    }

    toSingular(n) {
      return this.getNth(n).map(m => {
        let res = parseNoun(m)
        return toSingular(m, res)
      })
    }
    // create a new View, from this one
    update(pointer) {
      let m = new Nouns(this.document, pointer)
      m._cache = this._cache // share this full thing
      return m
    }
  }
  View.prototype.nouns = function (n) {
    let m = find(this)
    m = m.getNth(n)
    return new Nouns(this.document, m.pointer)
  }
}
export default api
