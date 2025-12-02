const find = function (doc) {
  let m = doc.match('(#Place|#Address)+')

  // split all commas except for 'paris, france'
  let splits = m.match('@hasComma')
  splits = splits.filter(c => {
    // split 'europe, china'
    if (c.has('(asia|africa|europe|america)$')) {
      return true
    }
    // don't split 'paris, france'
    if (c.has('(#City|#Region|#ProperNoun)$') && c.after('^(#Country|#Region)').found) {
      return false
    }
    return true
  })
  m = m.splitAfter(splits)
  return m
}
export default find
