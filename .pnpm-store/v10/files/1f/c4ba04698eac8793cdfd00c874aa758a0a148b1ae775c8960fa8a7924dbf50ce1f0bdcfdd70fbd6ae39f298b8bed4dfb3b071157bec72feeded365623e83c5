const freeze = function (view) {
  const world = view.world
  const { model, methods } = view.world
  const setTag = methods.one.setTag
  const { frozenLex } = model.one
  const multi = model.one._multiCache || {}

  view.docs.forEach(terms => {
    for (let i = 0; i < terms.length; i += 1) {
      // basic lexicon lookup
      let t = terms[i]
      let word = t.machine || t.normal

      // test a multi-word
      if (multi[word] !== undefined && terms[i + 1]) {
        let end = i + multi[word] - 1
        for (let k = end; k > i; k -= 1) {
          let words = terms.slice(i, k + 1)
          let str = words.map(term => term.machine || term.normal).join(' ')
          // lookup frozen lexicon
          if (frozenLex.hasOwnProperty(str) === true) {
            setTag(words, frozenLex[str], world, false, '1-frozen-multi-lexicon')
            words.forEach(term => (term.frozen = true))
            continue
          }
        }
      }
      // test single word
      if (frozenLex[word] !== undefined && frozenLex.hasOwnProperty(word)) {
        setTag([t], frozenLex[word], world, false, '1-freeze-lexicon')
        t.frozen = true
        continue
      }
    }
  })
}

const unfreeze = function (view) {
  view.docs.forEach(ts => {
    ts.forEach(term => {
      delete term.frozen
    })
  })
  return view
}
export default { frozen: freeze, freeze, unfreeze }
