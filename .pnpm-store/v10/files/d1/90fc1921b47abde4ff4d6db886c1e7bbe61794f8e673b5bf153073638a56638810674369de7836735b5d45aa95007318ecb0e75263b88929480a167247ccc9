/* eslint-disable no-console */
import parseVerb from './parse/index.js'
console.log('HELLOOO')
const reset = '\x1b[0m'
const yellow = str => `\x1b[2m\x1b[33m\x1b[3m ${str} ${reset}`
const bgGreen = str => `\x1b[42m\x1b[30m •${str}• ${reset}`
const dim = str => `\x1b[2m\x1b[3m ${str} ${reset}`
const red = str => `\x1b[2m\x1b[31m\x1b[3m ${str} ${reset}`
let ml = `    \x1b[32m\x1b[2m│${reset}`

const debug = function (vb) {
  let parse = parseVerb(vb)
  let root = bgGreen(parse.root.text())
  let aux = dim(parse.auxiliary.text())
  let not = ''
  if (parse.negative.found) {
    not = dim('[' + parse.negative.text() + ']')
  }
  let rb1 = yellow(parse.adverbs.pre.text())
  let rb2 = yellow(parse.adverbs.post.text())
  // line 1
  console.log(`\n`)
  let line = `${ml} ${rb1.padStart(25)} ${rb2.padStart(40)}`
  console.log(line)
  // line 2
  line = `${ml} ${aux.padStart(20)} ${not}  ` + root
  console.log(line.padStart(35))
  // line 3
  if (parse.phrasal.particle.found) {
    line = `${ml} [${parse.phrasal.verb.text()}] [${parse.phrasal.particle.text()}]`
    console.log(red(line).padStart(50))
  }
  console.log(`\n`)
  // call the original debug
  // vb.update(vb.pointer).debug()
}
export default debug
