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
import { fileURLToPath } from 'node:url'

const sourcePath = new URL('../vercel.redirects.json', import.meta.url)
const outputPath = new URL('../vercel.json', import.meta.url)

const INTERNAL_PREFIXES = ['/docs', '/guides', '/integrations', '/models', '/reference']

const HEADERS = [
  {
    source: '/(.*)',
    headers: [
      {
        key: 'Link',
        value: '</llms.txt>; rel="llms-txt"',
      },
      {
        key: 'X-Llms-Txt',
        value: '/llms.txt',
      },
    ],
  },
]

export function isInternalDocsDestination(value) {
  const pathname = value.split('#', 1)[0]
  return INTERNAL_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function isExternalUrl(value) {
  return value.startsWith('http://') || value.startsWith('https://')
}

export function toLlmsTxtPath(value) {
  const pathname = value.split('#', 1)[0]
  let llmsPath

  if (pathname.endsWith('/llms.txt')) {
    llmsPath = pathname
  } else if (pathname.length > 1 && pathname.endsWith('/')) {
    llmsPath = `${pathname.slice(0, -1)}/llms.txt`
  } else {
    llmsPath = `${pathname}/llms.txt`
  }

  return llmsPath
}

export function shouldGenerateLlmsRedirect(redirect) {
  const { source, destination } = redirect

  if (!source || !destination) return false
  if (isExternalUrl(destination)) return false
  if (!isInternalDocsDestination(source)) return false
  if (!isInternalDocsDestination(destination)) return false
  if (source.split('#', 1)[0].endsWith('/llms.txt')) return false
  if (destination.split('#', 1)[0].endsWith('/llms.txt')) return false

  return true
}

export function createLlmsRedirect(redirect) {
  return {
    ...redirect,
    source: toLlmsTxtPath(redirect.source),
    destination: toLlmsTxtPath(redirect.destination),
  }
}

export function assertNoDuplicateSources(redirects) {
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

export function assertNoRedirectChains(redirects) {
  const redirectsBySource = new Map(redirects.map(redirect => [redirect.source.split('#', 1)[0], redirect]))

  for (const redirect of redirects) {
    const destinationPath = redirect.destination.split('#', 1)[0]
    const nextRedirect = redirectsBySource.get(destinationPath)

    if (nextRedirect) {
      throw new Error(
        `Redirect chain detected: ${redirect.source} -> ${redirect.destination} -> ${nextRedirect.destination}`,
      )
    }
  }
}

export function generateRedirects(sourceRedirects) {
  assertNoDuplicateSources(sourceRedirects)
  assertNoRedirectChains(sourceRedirects)

  const generated = sourceRedirects.filter(shouldGenerateLlmsRedirect).map(createLlmsRedirect)
  const redirects = [...sourceRedirects, ...generated]
  assertNoDuplicateSources(redirects)
  return redirects
}

export async function main() {
  const raw = await fs.readFile(sourcePath, 'utf8')
  const config = JSON.parse(raw)

  if (!Array.isArray(config.redirects)) {
    throw new Error('Expected redirects array in vercel.redirects.json')
  }

  const redirects = generateRedirects(config.redirects)
  const generatedCount = redirects.length - config.redirects.length

  const output = {
    headers: HEADERS,
    redirects,
  }

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(
    `Wrote ${redirects.length} redirects (${config.redirects.length} base + ${generatedCount} llms companions)`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
