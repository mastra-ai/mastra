import failFast from './01-failFast.js'
import fromHere from './02-from-here.js'
import getGroup from './03-getGroup.js'
import notIf from './03-notIf.js'


// make proper pointers
const addSentence = function (res, n) {
  res.pointer[0] = n
  Object.keys(res.groups).forEach(k => {
    res.groups[k][0] = n
  })
  return res
}

const handleStart = function (terms, regs, n) {
  let res = fromHere(terms, regs, 0, terms.length)
  if (res) {
    res = addSentence(res, n)
    return res //getGroup([res], group)
  }
  return null
}

// ok, here we go.
const runMatch = function (docs, todo, cache) {
  cache = cache || []
  let { regs, group, justOne } = todo
  let results = []
  if (!regs || regs.length === 0) {
    return { ptrs: [], byGroup: {} }
  }

  const minLength = regs.filter(r => r.optional !== true && r.negative !== true).length
  docs: for (let n = 0; n < docs.length; n += 1) {
    let terms = docs[n]
    // let index = terms[0].index || []
    // can we skip this sentence?
    if (cache[n] && failFast(regs, cache[n])) {
      continue
    }
    // ^start regs only run once, per phrase
    if (regs[0].start === true) {
      let foundStart = handleStart(terms, regs, n, group)
      if (foundStart) {
        results.push(foundStart)
      }
      continue
    }
    //ok, try starting the match now from every term
    for (let i = 0; i < terms.length; i += 1) {
      let slice = terms.slice(i)
      // ensure it's long-enough
      if (slice.length < minLength) {
        break
      }
      let res = fromHere(slice, regs, i, terms.length)
      // did we find a result?
      if (res) {
        // res = addSentence(res, index[0])
        res = addSentence(res, n)
        results.push(res)
        // should we stop here?
        if (justOne === true) {
          break docs
        }
        // skip ahead, over these results
        let end = res.pointer[2]
        if (Math.abs(end - 1) > i) {
          i = Math.abs(end - 1)
        }
      }
    }
  }
  // ensure any end-results ($) match until the last term
  if (regs[regs.length - 1].end === true) {
    results = results.filter(res => {
      let n = res.pointer[0]
      return docs[n].length === res.pointer[2]
    })
  }
  if (todo.notIf) {
    results = notIf(results, todo.notIf, docs)
  }
  // grab the requested group
  results = getGroup(results, group)
  // add ids to pointers
  results.ptrs.forEach(ptr => {
    let [n, start, end] = ptr
    ptr[3] = docs[n][start].id//start-id
    ptr[4] = docs[n][end - 1].id//end-id
  })
  return results
}

export default runMatch
