/* eslint-disable no-console */
const blue = str => '\x1b[34m' + str + '\x1b[0m'
const dim = str => '\x1b[3m\x1b[2m' + str + '\x1b[0m'

const debug = function (view) {
  view.docs.forEach(terms => {
    console.log(blue('\n  ┌─────────'))
    terms.forEach(t => {
      let str = `  ${dim('│')}  `
      let txt = t.implicit || t.text || '-'
      if (t.frozen === true) {
        str += `${blue(txt)} ❄️`
      } else {
        str += dim(txt)
      }
      console.log(str)
    })
  })
}
export default debug
