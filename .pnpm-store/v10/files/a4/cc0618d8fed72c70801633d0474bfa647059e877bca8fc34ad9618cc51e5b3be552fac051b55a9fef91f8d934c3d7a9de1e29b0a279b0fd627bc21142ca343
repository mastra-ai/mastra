const byHyphen = function (terms, i, model, world) {
  const setTag = world.methods.one.setTag
  // two words w/ a dash
  if (terms[i].post === '-' && terms[i + 1]) {
    setTag([terms[i], terms[i + 1]], 'Hyphenated', world, null, `1-punct-hyphen''`)

    // bone-headed, man-made, good-tempered, coursely-ground
    // if (terms[i + 1].tags.has('PastTense')) {
    //   let tags = terms[i].tags
    //   if (tags.has('Noun') || tags.has('Adverb')) {
    //     setTag([terms[i], terms[i + 1]], 'Adjective', world, null, `2-punct-dash''`)
    //   }

    // }
  }
}
export default byHyphen
