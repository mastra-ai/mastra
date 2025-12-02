let net = null

// runs all match/tag patterns in model.two.matches
const postTagger = function (view) {
  const { world } = view
  const { model, methods } = world
  net = net || methods.one.buildNet(model.two.matches, world)
  // perform these matches on a comma-seperated document
  let document = methods.two.quickSplit(view.document)
  let ptrs = document.map(terms => {
    let t = terms[0]
    return [t.index[0], t.index[1], t.index[1] + terms.length]
  })
  let m = view.update(ptrs)
  m.cache()
  m.sweep(net)
  view.uncache()
  view.unfreeze()
  return view
}

// helper function for compute('tagger')
const tagger = view => view.compute(['freeze', 'lexicon', 'preTagger', 'postTagger', 'unfreeze'])

export default { postTagger, tagger }
