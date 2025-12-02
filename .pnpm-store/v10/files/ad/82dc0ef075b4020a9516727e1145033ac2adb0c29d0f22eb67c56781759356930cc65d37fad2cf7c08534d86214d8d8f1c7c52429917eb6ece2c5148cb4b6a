const byPunctuation = function (terms, i, model, world) {
  const setTag = world.methods.one.setTag
  // colon following first word
  // edit: foo
  // breaking: foobar
  if (i === 0 && terms.length >= 3) {
    const hasColon = /:/
    let post = terms[0].post
    if (post.match(hasColon)) {
      // phone: 555-2938
      let nextTerm = terms[1]
      if (nextTerm.tags.has('Value') || nextTerm.tags.has('Email') || nextTerm.tags.has('PhoneNumber')) {
        return
      }
      //
      setTag([terms[0]], 'Expression', world, null, `2-punct-colon''`)
    }
  }
}
export default byPunctuation
