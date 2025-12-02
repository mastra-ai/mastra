'use strict'
const encodings = new Set(['json', 'buffer', 'string'])

module.exports = mkrequest => (...args) => {
  const statusCodes = new Set()
  let method
  let encoding
  let headers
  let baseurl = ''

  args.forEach(arg => {
    if (typeof arg === 'string') {
      if (arg.toUpperCase() === arg) {
        if (method) {
          const msg = `Can't set method to ${arg}, already set to ${method}.`
          throw new Error(msg)
        } else {
          method = arg
        }
      } else if (arg.startsWith('http:') || arg.startsWith('https:')) {
        baseurl = arg
      } else {
        if (encodings.has(arg)) {
          encoding = arg
        } else {
          throw new Error(`Unknown encoding, ${arg}`)
        }
      }
    } else if (typeof arg === 'number') {
      statusCodes.add(arg)
    } else if (typeof arg === 'object') {
      if (Array.isArray(arg) || arg instanceof Set) {
        arg.forEach(code => statusCodes.add(code))
      } else {
        if (headers) {
          throw new Error('Cannot set headers twice.')
        }
        headers = arg
      }
    } else {
      throw new Error(`Unknown type: ${typeof arg}`)
    }
  })

  if (!method) method = 'GET'
  if (statusCodes.size === 0) {
    statusCodes.add(200)
  }

  return mkrequest(statusCodes, method, encoding, headers, baseurl)
}
