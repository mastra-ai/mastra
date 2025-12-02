import cleanup from './01-cleanup.js'
// import doUnicode from './02-unicode.js'
import doAcronyms from './02-acronyms.js'

const normalize = function (term, world) {
  const killUnicode = world.methods.one.killUnicode
  // console.log(world.methods.one)
  let str = term.text || ''
  str = cleanup(str)
  //(very) rough ASCII transliteration -  bjŏrk -> bjork
  str = killUnicode(str, world)
  str = doAcronyms(str)
  term.normal = str
}
export default normalize
