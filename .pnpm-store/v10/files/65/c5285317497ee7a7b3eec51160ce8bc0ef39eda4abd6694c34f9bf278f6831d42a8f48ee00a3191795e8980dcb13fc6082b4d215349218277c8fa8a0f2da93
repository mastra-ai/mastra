const isClientSide = () => typeof window !== 'undefined' && window.document

//output some helpful stuff to the console
const debug = function (fmt) {
  let debugMethods = this.methods.one.debug || {}
  // see if method name exists
  if (fmt && debugMethods.hasOwnProperty(fmt)) {
    debugMethods[fmt](this)
    return this
  }
  // log default client-side view
  if (isClientSide()) {
    debugMethods.clientSide(this)
    return this
  }
  // else, show regular server-side tags view
  debugMethods.tags(this)
  return this
}
export default debug
