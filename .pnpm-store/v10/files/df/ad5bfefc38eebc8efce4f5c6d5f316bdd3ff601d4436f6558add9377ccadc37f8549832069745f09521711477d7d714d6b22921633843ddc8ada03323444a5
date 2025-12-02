// add indexes to pointers
const harden = function () {
  this.ptrs = this.fullPointer
  return this
}
// remove indexes from pointers
const soften = function () {
  let ptr = this.ptrs
  if (!ptr || ptr.length < 1) {
    return this
  }
  ptr = ptr.map(a => a.slice(0, 3))
  this.ptrs = ptr
  return this
}
export default { harden, soften }