import find from './find.js'
import parse from './parse.js'
import gender from './gender.js'


const addMethod = function (View) {
  /**
   *
   */
  class People extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'People'
    }
    parse(n) {
      return this.getNth(n).map(parse)
    }
    json(n) {
      let opts = typeof n === 'object' ? n : {}
      return this.getNth(n).map(p => {
        let json = p.toView().json(opts)[0]
        let parsed = parse(p)
        json.person = {
          firstName: parsed.firstName.text('normal'),
          lastName: parsed.lastName.text('normal'),
          honorific: parsed.honorific.text('normal'),
          presumed_gender: gender(parsed, p),
        }
        return json
      }, [])
    }
    // used for co-reference resolution only
    presumedMale() {
      return this.filter(m => {
        return m.has('(#MaleName|mr|mister|sr|jr|king|pope|prince|sir)')//todo configure these in .world
      })
    }
    presumedFemale() {
      return this.filter(m => {
        return m.has('(#FemaleName|mrs|miss|queen|princess|madam)')
      })
    }
    // overloaded - keep People class
    update(pointer) {
      let m = new People(this.document, pointer)
      m._cache = this._cache // share this full thing
      return m
    }
  }

  View.prototype.people = function (n) {
    let m = find(this)
    m = m.getNth(n)
    return new People(this.document, m.pointer)
  }
}
export default addMethod
