/* eslint-disable no-console */
const logClientSide = function (view) {
  console.log('%c -=-=- ', 'background-color:#6699cc;')
  view.forEach(m => {
    console.groupCollapsed(m.text())
    let terms = m.docs[0]
    let out = terms.map(t => {
      let text = t.text || '-'
      if (t.implicit) {
        text = '[' + t.implicit + ']'
      }
      let tags = '[' + Array.from(t.tags).join(', ') + ']'
      return { text, tags }
    })
    console.table(out, ['text', 'tags'])
    console.groupEnd()
  })
}
export default logClientSide
