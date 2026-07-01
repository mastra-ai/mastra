/*
 * Redirect generation flow:
 * 1. Humans edit docs/vercel.redirects.json as the authored source of truth.
 * 2. This script reads that file and copies those redirects into docs/vercel.json.
 * 3. For eligible internal docs-family redirects, it also generates companion /llms.txt redirects.
 * 4. CI regenerates docs/vercel.json and fails if either file was changed without committing the matching generated output.
 *
 * In practice that means:
 * - editing docs/vercel.redirects.json requires re-running this generator and committing docs/vercel.json
 * - editing docs/vercel.json directly will be overwritten by this generator and fail CI drift checks
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const docsDir = new URL('..', import.meta.url)
const sourcePath = new URL('../vercel.redirects.json', import.meta.url)
const outputPath = new URL('../vercel.json', import.meta.url)

const INTERNAL_PREFIXES = ['/docs', '/guides', '/models', '/reference']

function isInternalDocsPath(value) {
  return INTERNAL_PREFIXES.some(prefix => value === prefix || value.startsWith(`${prefix}/`))
}

function isExternalUrl(value) {
  return value.startsWith('http://') || value.startsWith('https://')
}

function normalizeForLlms(pathname) {
  if (pathname.endsWith('/llms.txt')) return pathname
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return `${pathname.slice(0, -1)}/llms.txt`
  }
  return `${pathname}/llms.txt`
}

function shouldGenerateLlmsRedirect(redirect) {
  const { source, destination } = redirect

  if (!source || !destination) return false
  if (isExternalUrl(destination)) return false
  if (!isInternalDocsPath(source)) return false
  if (!isInternalDocsPath(destination)) return false
  if (source.endsWith('/llms.txt')) return false
  if (destination.endsWith('/llms.txt')) return false

  return true
}

function createLlmsRedirect(redirect) {
  return {
    ...redirect,
    source: normalizeForLlms(redirect.source),
    destination: normalizeForLlms(redirect.destination),
  }
}

function assertNoDuplicateSources(redirects) {
  const seen = new Map()

  for (const redirect of redirects) {
    if (seen.has(redirect.source)) {
      throw new Error(
        `Duplicate redirect source: ${redirect.source}\n` +
          `First: ${JSON.stringify(seen.get(redirect.source))}\n` +
          `Second: ${JSON.stringify(redirect)}`,
      )
    }
    seen.set(redirect.source, redirect)
  }
}

async function main() {
  const raw = await fs.readFile(sourcePath, 'utf8')
  const config = JSON.parse(raw)

  if (!Array.isArray(config.redirects)) {
    throw new Error('Expected redirects array in vercel.redirects.json')
  }

  const generated = config.redirects.filter(shouldGenerateLlmsRedirect).map(createLlmsRedirect)

  const finalRedirects = [...config.redirects, ...generated]

  assertNoDuplicateSources(finalRedirects)

  const output = {
    redirects: finalRedirects,
  }

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(
    `Wrote ${finalRedirects.length} redirects ` +
      `(${config.redirects.length} base + ${generated.length} llms companions)`,
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
