import { spawn } from 'node:child_process'
import { resolveBinaryPath } from './utils'

export async function spawnLocal(
  binaryName: string,
  args: string[],
  options: {
    env: NodeJS.ProcessEnv
    stdio: 'inherit' | 'ignore'
    // We start traversing the file system tree from this directory and we go up until we find the binary
    resolveFrom: string
    cwd: string
    onBinaryFound: (binaryLocation: string) => void
  }
): Promise<void> {
  let binaryLocation
  try {
    binaryLocation = resolveBinaryPath(options.env.PATH ?? '', options.resolveFrom, binaryName)
    options.onBinaryFound(binaryLocation)
  } catch (e) {
    console.error(e)
    throw new Error(
      `Binary ${binaryName} not found. Make sure postinstall script was allowed if it installs the binary`
    )
  }

  const child = spawn(binaryLocation, [...args], {
    shell: true,
    stdio: options?.stdio ?? 'inherit',
    env: options.env,
    cwd: options.cwd,
  })

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}
