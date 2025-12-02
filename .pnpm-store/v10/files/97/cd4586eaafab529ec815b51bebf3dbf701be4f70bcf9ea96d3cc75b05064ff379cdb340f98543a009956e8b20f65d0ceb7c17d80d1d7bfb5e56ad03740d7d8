/* eslint-disable no-console */
import cli from './_color.js'

const split = (txt, offset, index) => {
  let buff = index * 9 //there are 9 new chars addded to each highlight
  let start = offset.start + buff
  let end = start + offset.length
  let pre = txt.substring(0, start)
  let mid = txt.substring(start, end)
  let post = txt.substring(end, txt.length)
  return [pre, mid, post]
}

const spliceIn = function (txt, offset, index) {
  let parts = split(txt, offset, index)
  return `${parts[0]}${cli.blue(parts[1])}${parts[2]}`
}

const showHighlight = function (doc) {
  if (!doc.found) {
    return
  }
  let bySentence = {}
  doc.fullPointer.forEach(ptr => {
    bySentence[ptr[0]] = bySentence[ptr[0]] || []
    bySentence[ptr[0]].push(ptr)
  })
  Object.keys(bySentence).forEach(k => {
    let full = doc.update([[Number(k)]])
    let txt = full.text()
    let matches = doc.update(bySentence[k])
    let json = matches.json({ offset: true })
    json.forEach((obj, i) => {
      txt = spliceIn(txt, obj.offset, i)
    })
    console.log(txt)
  })
  console.log('\n')
}
export default showHighlight
