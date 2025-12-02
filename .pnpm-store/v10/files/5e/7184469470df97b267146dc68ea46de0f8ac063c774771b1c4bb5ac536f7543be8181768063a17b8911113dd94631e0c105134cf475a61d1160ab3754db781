const methods = {
  /** */
  cache: function () {
    this._cache = this.methods.one.cacheDoc(this.document)
    return this
  },
  /** */
  uncache: function () {
    this._cache = null
    return this
  },
}
const addAPI = function (View) {
  Object.assign(View.prototype, methods)
}
export default addAPI
