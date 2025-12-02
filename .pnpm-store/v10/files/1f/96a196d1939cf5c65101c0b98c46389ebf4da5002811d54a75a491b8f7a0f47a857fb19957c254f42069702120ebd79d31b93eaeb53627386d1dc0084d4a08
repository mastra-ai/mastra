import { indexN } from '../api/lib/_lib.js'
import splitAll from '../api/lib/split.js'
import getDoc from './getDoc.js'

// flat list of terms from nested document
const termList = function (docs) {
  let arr = []
  for (let i = 0; i < docs.length; i += 1) {
    for (let t = 0; t < docs[i].length; t += 1) {
      arr.push(docs[i][t])
    }
  }
  return arr
}

export default {
  one: {
    termList,
    getDoc,
    pointer: {
      indexN,
      splitAll,
    }
  },
}
