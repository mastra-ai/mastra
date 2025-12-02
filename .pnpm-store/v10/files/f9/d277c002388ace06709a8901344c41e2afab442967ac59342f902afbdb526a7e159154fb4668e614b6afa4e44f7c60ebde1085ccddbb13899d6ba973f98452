
let breaks = '(but|however|and|so|thus|therefor)'

const parsePivot = function (chunk) {
  let str = chunk.text('normal')
  let breakPoint = chunk.has(breaks)
  return {
    breakPoint,
    root: str
  }
}
export default parsePivot