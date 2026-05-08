// Fixture: User uses __filename and __dirname without declaring them (needs shim)
export function getDir() {
  return __dirname;
}

export function getFile() {
  return __filename;
}
