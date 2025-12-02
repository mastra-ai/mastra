export const isObject = item => item && typeof item === 'object' && !Array.isArray(item)

export const isArray = arr => Object.prototype.toString.call(arr) === '[object Array]'

export const isSet = item => item instanceof Set

const parsePointer = str => {
  if (typeof str !== 'string') {
    return str
  }
  str = str.replace(/^\//, '')
  return str.split(/\//)
}

export const getByPointer = (node, str) => {
  str = str || ''
  let ptr = parsePointer(str)
  for (let i = 0; i < ptr.length; i += 1) {
    let found = node.children.find(obj => obj.id === ptr[i])
    if (!found) {
      return null
    }
    node = found
  }
  return node
}

export const normalize = str => {
  str = str || ''
  return str.trim()
}
