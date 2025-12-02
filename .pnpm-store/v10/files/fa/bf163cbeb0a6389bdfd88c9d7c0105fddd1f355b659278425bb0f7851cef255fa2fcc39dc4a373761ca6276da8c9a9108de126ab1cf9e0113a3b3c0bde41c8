import uuid from './uuid.js'

const compute = {
  id: function (view) {
    let docs = view.docs
    for (let n = 0; n < docs.length; n += 1) {
      for (let i = 0; i < docs[n].length; i += 1) {
        let term = docs[n][i]
        term.id = term.id || uuid(term)
      }
    }
  }
}

export default compute