import { atom } from '../atom/index.js'
import { getPath, setPath } from './path.js'

export { getPath, setByKey, setPath } from './path.js'

let warned = false

function warn(text) {
  if (typeof console !== 'undefined' && console.warn) {
    console.groupCollapsed('Nano Stores: ' + text)
    console.trace('Source of deprecated call')
    console.groupEnd()
  }
}

/* @__NO_SIDE_EFFECTS__ */
export const deepMap = (initial = {}) => {
  if (process.env.NODE_ENV !== 'production') {
    if (!warned) {
      warned = true
      warn(
        'Move to deepmap() from @nanostores/deepmap. ' +
          'deepmap() will be removed in 2.0.'
      )
    }
  }

  let $deepMap = atom(initial)
  $deepMap.setKey = (key, value) => {
    if (getPath($deepMap.value, key) !== value) {
      let oldValue = $deepMap.value
      $deepMap.value = setPath($deepMap.value, key, value)
      $deepMap.notify(oldValue, key)
    }
  }
  return $deepMap
}

export function getKey(store, key) {
  let value = store.get()
  return getPath(value, key)
}
