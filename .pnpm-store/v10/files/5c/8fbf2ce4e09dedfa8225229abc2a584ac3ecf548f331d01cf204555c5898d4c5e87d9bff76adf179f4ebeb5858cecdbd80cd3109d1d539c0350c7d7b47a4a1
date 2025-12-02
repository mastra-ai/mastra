import { spawn } from 'cross-spawn'

export async function spawnLocal(
  executable: string,
  args: string[],
  options: {
    env: NodeJS.ProcessEnv
    stdio: 'inherit' | 'ignore'
    cwd: string
  }
): Promise<void> {
  const child = spawn(executable, [...args], {
    stdio: options.stdio ?? 'inherit',
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
