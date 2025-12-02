const max = 20

// sweep-around looking for our start term uuid
const blindSweep = function (id, doc, n) {
  for (let i = 0; i < max; i += 1) {
    // look up a sentence
    if (doc[n - i]) {
      let index = doc[n - i].findIndex(term => term.id === id)
      if (index !== -1) {
        return [n - i, index]
      }
    }
    // look down a sentence
    if (doc[n + i]) {
      let index = doc[n + i].findIndex(term => term.id === id)
      if (index !== -1) {
        return [n + i, index]
      }
    }
  }
  return null
}

const repairEnding = function (ptr, document) {
  let [n, start, , , endId] = ptr
  let terms = document[n]
  // look for end-id
  let newEnd = terms.findIndex(t => t.id === endId)
  if (newEnd === -1) {
    // if end-term wasn't found, so go all the way to the end
    ptr[2] = document[n].length
    ptr[4] = terms.length ? terms[terms.length - 1].id : null
  } else {
    ptr[2] = newEnd // repair ending pointer
  }
  return document[n].slice(start, ptr[2] + 1)
}

/** return a subset of the document, from a pointer */
const getDoc = function (ptrs, document) {
  let doc = []
  ptrs.forEach((ptr, i) => {
    if (!ptr) {
      return
    }
    let [n, start, end, id, endId] = ptr //parsePointer(ptr)
    let terms = document[n] || []
    if (start === undefined) {
      start = 0
    }
    if (end === undefined) {
      end = terms.length
    }
    if (id && (!terms[start] || terms[start].id !== id)) {
      // console.log('  repairing pointer...')
      let wild = blindSweep(id, document, n)
      if (wild !== null) {
        let len = end - start
        terms = document[wild[0]].slice(wild[1], wild[1] + len)
        // actually change the pointer
        let startId = terms[0] ? terms[0].id : null
        ptrs[i] = [wild[0], wild[1], wild[1] + len, startId]
      }
    } else {
      terms = terms.slice(start, end)
    }
    if (terms.length === 0) {
      return
    }
    if (start === end) {
      return
    }
    // test end-id, if it exists
    if (endId && terms[terms.length - 1].id !== endId) {
      terms = repairEnding(ptr, document)
    }
    // otherwise, looks good!
    doc.push(terms)
  })
  doc = doc.filter(a => a.length > 0)
  return doc
}
export default getDoc