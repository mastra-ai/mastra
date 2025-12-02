const hasSlash = /\//
const hasDomain = /[a-z]\.[a-z]/i
const isMath = /[0-9]/
// const hasSlash = /[a-z\u00C0-\u00FF] ?\/ ?[a-z\u00C0-\u00FF]/
// const hasApostrophe = /['’]s$/

const addAliases = function (term, world) {
  let str = term.normal || term.text || term.machine
  const aliases = world.model.one.aliases
  // lookup known aliases like '&'
  if (aliases.hasOwnProperty(str)) {
    term.alias = term.alias || []
    term.alias.push(aliases[str])
  }
  // support slashes as aliases
  if (hasSlash.test(str) && !hasDomain.test(str) && !isMath.test(str)) {
    let arr = str.split(hasSlash)
    // don't split urls and things
    if (arr.length <= 3) {
      arr.forEach(word => {
        word = word.trim()
        if (word !== '') {
          term.alias = term.alias || []
          term.alias.push(word)
        }
      })
    }
  }
  // aliases for apostrophe-s
  // if (hasApostrophe.test(str)) {
  //   let main = str.replace(hasApostrophe, '').trim()
  //   term.alias = term.alias || []
  //   term.alias.push(main)
  // }
  return term
}
export default addAliases
