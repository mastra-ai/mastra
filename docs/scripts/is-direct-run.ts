import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

function realPath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}

/** True when the module at `moduleUrl` is the script Node was asked to run (not an import). */
export function isDirectRun(moduleUrl: string): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const modulePath = realPath(fileURLToPath(moduleUrl))
  const entryPath = path.resolve(entry)
  const candidates = [entryPath, `${entryPath}.ts`].filter(p => fs.existsSync(p)).map(realPath)
  return [entryPath, ...candidates].includes(modulePath)
}
