import { execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, unlinkSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isWindows = process.platform === 'win32'
const VALE_VERSION = '3.13.1'
const OUTPUT_PATH = join(__dirname, 'bin')
const OUTPUT_BIN = join(OUTPUT_PATH, isWindows ? 'vale.exe' : 'vale')

function getPlatform() {
  const { platform, arch } = process

  if (platform === 'win32') {
    if (arch === 'x64') return 'Windows_64-bit'
    throw new Error(`Unsupported architecture: ${arch} on Windows`)
  }
  if (platform === 'linux') {
    if (arch === 'x64') return 'Linux_64-bit'
    if (arch === 'arm64') return 'Linux_arm64'
    throw new Error(`Unsupported architecture: ${arch} on Linux`)
  }
  if (platform === 'darwin') {
    if (arch === 'x64') return 'macOS_64-bit'
    if (arch === 'arm64') return 'macOS_arm64'
    throw new Error(`Unsupported architecture: ${arch} on macOS`)
  }

  throw new Error(`Unsupported platform: ${platform}`)
}

function getReleaseUrl() {
  const platform = getPlatform()
  const ext = isWindows ? '.zip' : '.tar.gz'
  return `https://github.com/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_${platform}${ext}`
}

async function downloadAndExtract() {
  const url = getReleaseUrl()
  const ext = isWindows ? '.zip' : '.tar.gz'
  const tmpFile = join(OUTPUT_PATH, `vale${ext}`)

  console.log(`Downloading Vale ${VALE_VERSION} from ${url}`)

  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  await pipeline(response.body, createWriteStream(tmpFile))

  console.log(`Extracting to ${OUTPUT_PATH}`)
  execFileSync('tar', ['-xf', tmpFile, '-C', OUTPUT_PATH])

  unlinkSync(tmpFile)

  if (!isWindows) {
    chmodSync(OUTPUT_BIN, 0o755)
  }

  console.log(`Vale ${VALE_VERSION} installed to ${OUTPUT_BIN}`)
}

if (!existsSync(OUTPUT_PATH)) {
  mkdirSync(OUTPUT_PATH, { recursive: true })
}

if (!existsSync(OUTPUT_BIN)) {
  await downloadAndExtract()
} else {
  console.log(`Vale already exists at ${OUTPUT_BIN}`)
}
