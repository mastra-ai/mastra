import parseVerb from './verb.js'
import parseNoun from './noun.js'
import parseAdjective from './adjective.js'
import parsePivot from './pivot.js'
import postProcess from './postProcess.js'

const chunkType = function (chunk) {
  if (chunk.isVerb().found) {
    return 'Verb'
  }
  if (chunk.isNoun().found) {
    return 'Noun'
  }
  if (chunk.isPivot().found) {
    return 'Pivot'
  }
  if (chunk.isAdjective().found) {
    return 'Adjective'
  }
  return null
}

const getParts = function (s) {
  let parts = []
  let res = {}
  let pivot = null

  const process = {
    // "the big red dog"
    Noun: (chunk) => {
      // we looking for a subject?
      if (!res.verb) {
        res.subj = parseNoun(chunk)
      } else {
        // do we already have an object?
        if (res.obj) {
          if (pivot) {
            res.obj.mod = res.obj.mod || {}
            res.obj.mod[pivot] = parseNoun(chunk)
          } else {
            // console.log('=-=-=-= missing mod -=-=-=-')
          }
        } else {
          res.obj = parseNoun(chunk)
          res.obj.pivot = pivot
        }
      }
    },
    // "had walked"
    Verb: (chunk) => {
      if (res.verb) {
        parts.push(res)
        res = {}
      }
      res.verb = parseVerb(chunk)
    },
    // "is pretty"
    Adjective: (chunk) => {
      res.obj = parseAdjective(chunk)
    },
    // "however"
    Pivot: (chunk) => {
      let p = parsePivot(chunk)
      pivot = p.root
      if (res.obj && p.breakPoint) {
        parts.push(res)
        res = {}
      }
    },
  }

  // handle each svp chunk
  let chunks = s.chunks()
  // chunks.debug()
  chunks.forEach(chunk => {
    let type = chunkType(chunk)
    if (!type) {
      // console.log(' ! ' + chunk.text())
      return
    }
    process[type](chunk)
  })
  // add remainder
  if (Object.keys(res).length) {
    parts.push(res)
  }
  return parts
}



const parseFacts = function (s) {
  let parts = getParts(s)
  // share missing subjects
  parts = postProcess(parts)

  parts.forEach(part => {
    part.ptr = s.ptrs[0]
  })
  // console.log(parts)
  // if (s.isQuestion().found) {
  //   return parseQuestion(s)
  // }
  // if (s.has('#Imperative')) {
  //   return parseInstruction(s)
  // }
  // return parseStatement(s)
  return parts
}
export default parseFacts