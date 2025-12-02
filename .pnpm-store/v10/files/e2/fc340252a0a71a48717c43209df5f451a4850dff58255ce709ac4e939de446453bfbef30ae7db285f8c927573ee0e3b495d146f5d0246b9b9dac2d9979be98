/* eslint-disable no-console */
import cli from './_color.js'

const tagString = function (tags, model) {
  if (model.one.tagSet) {
    tags = tags.map(tag => {
      if (!model.one.tagSet.hasOwnProperty(tag)) {
        return tag
      }
      const c = model.one.tagSet[tag].color || 'blue'
      return cli[c](tag)
    })
  }
  return tags.join(', ')
}

const showTags = function (view) {
  let { docs, model } = view
  if (docs.length === 0) {
    console.log(cli.blue('\n     ──────'))
  }
  docs.forEach(terms => {
    console.log(cli.blue('\n  ┌─────────'))
    terms.forEach(t => {
      let tags = [...(t.tags || [])]
      let text = t.text || '-'
      if (t.sense) {
        text = `{${t.normal}/${t.sense}}`
      }
      if (t.implicit) {
        text = '[' + t.implicit + ']'
      }
      text = cli.yellow(text)
      let word = "'" + text + "'"
      if (t.reference) {
        let str = view.update([t.reference]).text('normal')
        word += ` - ${cli.dim(cli.i('[' + str + ']'))}`
      }
      word = word.padEnd(18)
      let str = cli.blue('  │ ') + cli.i(word) + '  - ' + tagString(tags, model)
      console.log(str)
    })
  })
  console.log('\n')
}
export default showTags
