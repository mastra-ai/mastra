
export default {
  /** pre-parse any match statements */
  parseMatch: function (str, opts) {
    const world = this.world()
    let killUnicode = world.methods.one.killUnicode
    if (killUnicode) {
      str = killUnicode(str, world)
    }
    return world.methods.one.parseMatch(str, opts, world)
  }
}