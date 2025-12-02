const postProcess = function (parts) {

  for (let i = 1; i < parts.length; i += 1) {
    // is it missing a subject?
    // borrow the last one
    if (!parts[i].subj && parts[i].verb) {
      for (let o = i; o >= 0; o -= 1) {
        if (parts[o].subj) {
          parts[i].subj = Object.assign({ borrowed: true }, parts[o].subj)
          break
        }
      }
    }
  }
  return parts
}
export default postProcess