// split adverbs as before/after the root
const getAdverbs = function (vb, root) {
  let res = {
    pre: vb.none(),
    post: vb.none(),
  }
  if (!vb.has('#Adverb')) {
    return res
  }
  // pivot on the main verb
  let parts = vb.splitOn(root)
  if (parts.length === 3) {
    return {
      pre: parts.eq(0).adverbs(),
      post: parts.eq(2).adverbs(),
    }
  }
  // it must be the second one
  if (parts.eq(0).isDoc(root)) {
    res.post = parts.eq(1).adverbs()
    return res
  }
  res.pre = parts.eq(0).adverbs()
  return res
}
export default getAdverbs
