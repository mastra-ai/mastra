import html from './html.js'
import json from './json.js'
import out from './out.js'
import text from './text.js'

const methods = Object.assign({}, out, text, json, html)

const addAPI = function (View) {
  Object.assign(View.prototype, methods)
}
export default addAPI
