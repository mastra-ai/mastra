import path from 'node:path'
import fs from 'node:fs'

const getLocalPaths = (startPath: string): string[] => {
  const paths: string[] = []
  let currentPath = startPath

  while (true) {
    paths.push(currentPath)
    const parentPath = path.resolve(currentPath, '..')

    // If we've reached the root directory, stop
    if (parentPath === currentPath) {
      break
    }

    currentPath = parentPath
  }

  return paths
}

export const buildLocalBinaryPaths = (cwd: string): string[] => {
  const localPaths = getLocalPaths(path.resolve(cwd)).map((localPath: string) =>
    path.join(localPath, 'node_modules/.bin')
  )
  return localPaths
}

export function resolveBinaryPath(
  binName: string,
  options: {
    path: string
    // We start traversing the file system tree from this directory and we go up until we find the binary
    cwd: string
  }
): string {
  const envLocations = options.path.split(path.delimiter)
  const localLocations = buildLocalBinaryPaths(options.cwd)
  const directories = [...new Set([...localLocations, ...envLocations])]
  for (const directory of directories) {
    const binaryPath = path.join(directory, binName)
    if (fs.existsSync(binaryPath)) {
      return binaryPath
    }
  }
  throw new Error(`Binary ${binName} not found`)
}
