import tokenize from './tokenize.js'

const parseTerm = (txt, model) => {
  // cleanup any punctuation as whitespace
  let { str, pre, post } = tokenize(txt, model)
  const parsed = {
    text: str,
    pre: pre,
    post: post,
    tags: new Set(),
  }
  return parsed
}
export default parseTerm
