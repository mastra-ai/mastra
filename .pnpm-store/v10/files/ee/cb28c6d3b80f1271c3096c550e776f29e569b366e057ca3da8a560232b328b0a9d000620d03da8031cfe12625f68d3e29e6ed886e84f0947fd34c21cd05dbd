import compute from './compute.js'
import debug from './debug.js'

export default {
  // add .compute('freeze')
  compute,

  mutate: world => {
    const methods = world.methods.one
    // add @isFrozen method
    methods.termMethods.isFrozen = term => term.frozen === true
    // adds `.debug('frozen')`
    methods.debug.freeze = debug
    methods.debug.frozen = debug
  },

  api: function (View) {
    // set all terms to reject any desctructive tags
    View.prototype.freeze = function () {
      this.docs.forEach(ts => {
        ts.forEach(term => {
          term.frozen = true
        })
      })
      return this
    }
    // reset all terms to allow  any desctructive tags
    View.prototype.unfreeze = function () {
      this.compute('unfreeze')
    }
    // return all frozen terms
    View.prototype.isFrozen = function () {
      return this.match('@isFrozen+')
    }
  },
  // run it in init
  hooks: ['freeze'],
}
