const dollarStub = /\$[0-9a-z]+/g
const fns = {}

// case logic
const isTitleCase = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str) || /^\p{Lu}$/u.test(str)
const toTitleCase = (str) => str.replace(/^\p{Ll}/u, x => x.toUpperCase())
const toLowerCase = (str) => str.replace(/^\p{Lu}/u, x => x.toLowerCase())

// doc.replace('foo', (m)=>{})
const replaceByFn = function (main, fn, keep) {
  main.forEach(m => {
    let out = fn(m)
    m.replaceWith(out, keep)
  })
  return main
}

// support 'foo $0' replacements
const subDollarSign = function (input, main) {
  if (typeof input !== 'string') {
    return input
  }
  let groups = main.groups()
  input = input.replace(dollarStub, a => {
    let num = a.replace(/\$/, '')
    if (groups.hasOwnProperty(num)) {
      return groups[num].text()
    }
    return a
  })
  return input
}

fns.replaceWith = function (input, keep = {}) {
  let ptrs = this.fullPointer
  let main = this
  this.uncache()
  if (typeof input === 'function') {
    return replaceByFn(main, input, keep)
  }
  let terms = main.docs[0]
  if (!terms) return main
  let isOriginalPossessive = keep.possessives && terms[terms.length - 1].tags.has('Possessive')
  let isOriginalTitleCase = keep.case && isTitleCase(terms[0].text)
  // support 'foo $0' replacements
  input = subDollarSign(input, main)

  let original = this.update(ptrs)
  // soften-up pointer
  ptrs = ptrs.map(ptr => ptr.slice(0, 3))
  // original.freeze()
  let oldTags = (original.docs[0] || []).map(term => Array.from(term.tags))
  let originalPre = original.docs[0][0].pre
  let originalPost = original.docs[0][original.docs[0].length - 1].post
  // slide this in
  if (typeof input === 'string') {
    input = this.fromText(input).compute('id')
  }
  main.insertAfter(input)
  // are we replacing part of a contraction?
  if (original.has('@hasContraction') && main.contractions) {
    let more = main.grow('@hasContraction+')
    more.contractions().expand()
  }
  // delete the original terms
  main.delete(original) //science.

  // keep "John's"
  if (isOriginalPossessive) {
    let tmp = main.docs[0]
    let term = tmp[tmp.length - 1]
    if (!term.tags.has('Possessive')) {
      term.text += "'s"
      term.normal += "'s"
      term.tags.add('Possessive')
    }
  }

  // try to keep some pre-punctuation
  if (originalPre && main.docs[0]) {
    main.docs[0][0].pre = originalPre
  }
  // try to keep any post-punctuation
  if (originalPost && main.docs[0]) {
    let lastOne = main.docs[0][main.docs[0].length - 1]
    if (!lastOne.post.trim()) {
      lastOne.post = originalPost
    }
  }

  // what should we return?
  let m = main.toView(ptrs).compute(['index', 'freeze', 'lexicon'])
  if (m.world.compute.preTagger) {
    m.compute('preTagger')
  }
  m.compute('unfreeze')
  // replace any old tags
  if (keep.tags) {
    m.terms().forEach((term, i) => {
      term.tagSafe(oldTags[i])
    })
  }

  if (!m.docs[0] || !m.docs[0][0]) return m

  // try to co-erce case, too
  if (keep.case) {
    let transformCase = isOriginalTitleCase ? toTitleCase : toLowerCase
    m.docs[0][0].text = transformCase(m.docs[0][0].text)
  }

  // console.log(input.docs[0])
  // let regs = input.docs[0].map(t => {
  //   return { id: t.id, optional: true }
  // })
  // m.after('(a|hoy)').debug()
  // m.growRight('(a|hoy)').debug()
  // console.log(m)
  return m
}

fns.replace = function (match, input, keep) {
  if (match && !input) {
    return this.replaceWith(match, keep)
  }
  let m = this.match(match)
  if (!m.found) {
    return this
  }
  this.soften()
  return m.replaceWith(input, keep)
}
export default fns
