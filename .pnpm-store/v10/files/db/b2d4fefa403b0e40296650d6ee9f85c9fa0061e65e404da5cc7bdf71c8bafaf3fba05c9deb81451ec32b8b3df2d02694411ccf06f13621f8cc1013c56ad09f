import { SupportedStorage } from './types'

/**
 * Returns a localStorage-like object that stores the key-value pairs in
 * memory.
 */
export function memoryLocalStorageAdapter(store: { [key: string]: string } = {}): SupportedStorage {
  return {
    getItem: (key) => {
      return store[key] || null
    },

    setItem: (key, value) => {
      store[key] = value
    },

    removeItem: (key) => {
      delete store[key]
    },
  }
}
