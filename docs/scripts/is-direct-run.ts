import path from 'path'
import { fileURLToPath } from 'url'

/** True when the module at `moduleUrl` is the script Node was asked to run (not an import). */
export function isDirectRun(moduleUrl: string): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const modulePath = fileURLToPath(moduleUrl)
  const entryPath = path.resolve(entry)
  return entryPath === modulePath || entryPath === modulePath.replace(/\.ts$/, '')
}
