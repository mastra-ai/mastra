import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}
const read = () => window.location.hash.slice(1)
const server = () => undefined

export default function useApiHash() {
  return useSyncExternalStore<string | undefined>(subscribe, read, server)
}
