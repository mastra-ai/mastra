/**
 * Relocates Mastra docs MDX files (single file or batch using glob patterns).
 *
 * At a high level, the script does the following in the docs package:
 * 1. Moves the mdx file(s) under src/content/en/<family>
 * 2. Updates matching Docusaurus sidebar doc ids for same-family moves
 * 3. Updates links in MDX files that point to the old route(s)
 * 4. Adds redirect(s) to vercel.redirects.json
 * 5. Updates existing redirects to point to the new route(s)
 *
 * @example Single file move:
 * pnpm tsx scripts/move-doc.ts /docs/agents/old /docs/agents/new
 *
 * @example Batch move with glob patterns:
 * pnpm tsx scripts/move-doc.ts "/docs/old/**" "/docs/new/**"
 *
 * Note:
 * - The .mdx extension should be omitted from routes.
 * - Supported editable route families are /docs, /reference, and /guides.
 * - /models is auto-generated and intentionally unsupported.
 * - When using glob patterns, both source and destination must be glob patterns.
 * - Glob patterns should be quoted to prevent shell expansion.
 * - After a non-dry run, run `pnpm run generate-vercel-redirects` and commit vercel.json.
 */

import fs from 'fs/promises'
import type { Dirent } from 'fs'
import path from 'path'
import { glob } from 'tinyglobby'

const VERCEL_REDIRECTS_FILE = 'vercel.redirects.json'
const CONTENT_ROOT = 'src/content/en'

const FAMILIES = {
  '/docs': 'docs',
  '/reference': 'reference',
  '/guides': 'guides',
} as const

const GENERATED_ROUTE_PREFIXES = ['/models'] as const

type RoutePrefix = keyof typeof FAMILIES
type Family = (typeof FAMILIES)[RoutePrefix]

interface PathWithHash {
  path: string
  hash: string
}

interface Redirect {
  source: string
  destination: string
  permanent: boolean
}

interface RedirectConfig {
  redirects: Redirect[]
}

interface MoveResult {
  source: string
  destination: string | null
  status: 'success' | 'failed' | 'would-move'
  error?: string
}

interface MoveDocumentsResult {
  success: boolean
  message: string
  results: MoveResult[]
}

interface MoveDocumentsOptions {
  verbose?: boolean
  dryRun?: boolean
}

interface UpdateRedirectsOptions {
  glob?: boolean
}

const splitPathAndHash = (url: string): PathWithHash => {
  const [path, hash] = url.split('#')
  return { path, hash: hash ? `#${hash}` : '' }
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isRouteInPrefix = (routePath: string, prefix: string): boolean =>
  routePath === prefix || routePath.startsWith(`${prefix}/`)

const assertEditableRoute = (route: string): void => {
  const { path: routePath } = splitPathAndHash(route)
  const generatedPrefix = GENERATED_ROUTE_PREFIXES.find(prefix => isRouteInPrefix(routePath, prefix))

  if (generatedPrefix) {
    throw new Error(
      `Unsupported generated docs route: ${route}. ${generatedPrefix} pages are auto-generated and cannot be moved.`,
    )
  }
}

const getRoutePrefix = (route: string): RoutePrefix => {
  const { path: routePath } = splitPathAndHash(route)
  assertEditableRoute(routePath)

  const prefix = Object.keys(FAMILIES).find(candidate => isRouteInPrefix(routePath, candidate))

  if (!prefix) {
    throw new Error(
      `Unsupported docs route: ${route}. Expected route to start with ${Object.keys(FAMILIES).join(', ')}`,
    )
  }

  return prefix as RoutePrefix
}

const routeToFamily = (route: string): Family => FAMILIES[getRoutePrefix(route)]

const routeToSidebarId = (route: string): string => {
  const { path: routePath } = splitPathAndHash(route)
  const prefix = getRoutePrefix(routePath)
  const id = routePath.slice(prefix.length).replace(/^\//, '')
  return id || 'index'
}

const routeToFilePath = (route: string): string => {
  const { path: routePath } = splitPathAndHash(route)
  const family = routeToFamily(routePath)
  const id = routeToSidebarId(routePath)
  return path.join(CONTENT_ROOT, family, `${id}.mdx`)
}

const filePathToRoute = (filePath: string): string => {
  const normalized = filePath.split(path.sep).join('/').replace(/^\.\//, '')
  const prefix = `${CONTENT_ROOT}/`

  if (!normalized.startsWith(prefix) || !normalized.endsWith('.mdx')) {
    throw new Error(`Unsupported docs file path: ${filePath}. Expected path under ${CONTENT_ROOT} ending in .mdx`)
  }

  const withoutRoot = normalized.slice(prefix.length).replace(/\.mdx$/, '')
  const [family, ...rest] = withoutRoot.split('/')

  if (!family || !(Object.values(FAMILIES) as string[]).includes(family) || rest.length === 0) {
    throw new Error(`Unsupported docs file path: ${filePath}`)
  }

  const routePrefix = Object.entries(FAMILIES).find(([, value]) => value === family)?.[0]
  return `${routePrefix}/${rest.join('/')}`
}

const resolveRelativeRoute = (fromRoute: string, linkPath: string): string => {
  const { path: fromBasePath } = splitPathAndHash(fromRoute)
  const { path: linkBasePath } = splitPathAndHash(linkPath)
  const fromDir = path.posix.dirname(fromBasePath)
  return path.posix.normalize(path.posix.join(fromDir, linkBasePath))
}

const routeToRelativeLink = (fromRoute: string, toRoute: string): string => {
  const { path: fromBasePath } = splitPathAndHash(fromRoute)
  const fromDir = path.posix.dirname(fromBasePath)
  const relativePath = path.posix.relative(fromDir, toRoute)

  if (!relativePath || relativePath.startsWith('../')) return relativePath || './'
  return `./${relativePath}`
}

const readRedirectConfig = async (): Promise<RedirectConfig> => {
  const content = await fs.readFile(VERCEL_REDIRECTS_FILE, 'utf-8')
  const data = JSON.parse(content)

  if (!data || !Array.isArray(data.redirects)) {
    throw new Error(`Expected redirects array in ${VERCEL_REDIRECTS_FILE}`)
  }

  return data
}

const writeRedirectConfig = async (data: RedirectConfig): Promise<void> => {
  await fs.writeFile(VERCEL_REDIRECTS_FILE, `${JSON.stringify(data, null, 2)}\n`)
}

const dedupeRedirectsBySource = (redirects: Redirect[]): Redirect[] => {
  const seen = new Set<string>()
  const deduped: Redirect[] = []

  for (let index = redirects.length - 1; index >= 0; index--) {
    const redirect = redirects[index]
    if (seen.has(redirect.source)) continue
    seen.add(redirect.source)
    deduped.unshift({ ...redirect, permanent: true })
  }

  return deduped
}

const findRedirectChain = (redirects: Redirect[], targetPath: string): Redirect[] => {
  const chain: Redirect[] = []
  const seen = new Set<string>()

  const findSources = (candidatePath: string): void => {
    redirects.forEach(redirect => {
      const { path: sourcePath } = splitPathAndHash(redirect.source)
      const { path: destPath } = splitPathAndHash(redirect.destination)
      if (destPath === candidatePath && !seen.has(redirect.source)) {
        chain.push(redirect)
        seen.add(redirect.source)
        findSources(sourcePath)
      }
    })
  }

  findSources(targetPath)
  return chain
}

const updateSidebarDocIds = async (oldRoute: string, newRoute: string): Promise<void> => {
  const oldFamily = routeToFamily(oldRoute)
  const newFamily = routeToFamily(newRoute)
  const oldId = routeToSidebarId(oldRoute)
  const newId = routeToSidebarId(newRoute)

  if (oldFamily !== newFamily) {
    console.warn(
      `Cross-family move detected (${oldRoute} -> ${newRoute}). Update sidebars manually: remove ${oldId} from ${oldFamily}/sidebars.js and add ${newId} to ${newFamily}/sidebars.js.`,
    )
    return
  }

  const sidebarPath = path.join(CONTENT_ROOT, newFamily, 'sidebars.js')

  try {
    const content = await fs.readFile(sidebarPath, 'utf-8')
    let updatedContent = content

    updatedContent = updatedContent.replace(new RegExp(`(id:\\s*)'${escapeRegExp(oldId)}'`, 'g'), `$1'${newId}'`)
    updatedContent = updatedContent.replace(new RegExp(`(id:\\s*)"${escapeRegExp(oldId)}"`, 'g'), `$1"${newId}"`)

    if (updatedContent !== content) {
      await fs.writeFile(sidebarPath, updatedContent)
      console.log(`Updated sidebar id in ${sidebarPath}: ${oldId} -> ${newId}`)
    } else {
      console.warn(`No sidebar id found for ${oldId} in ${sidebarPath}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`No sidebar file found at ${sidebarPath}; update sidebar manually if needed.`)
      return
    }

    throw error
  }
}

const updateMdxLinks = async (oldPaths: string[], newPath: string): Promise<void> => {
  const processFile = async (filePath: string): Promise<void> => {
    const content = await fs.readFile(filePath, 'utf-8')
    let updatedContent = content
    const currentRoute = filePathToRoute(filePath)

    oldPaths.forEach(oldPath => {
      const { path: oldBasePath } = splitPathAndHash(oldPath)
      const { path: newBasePath, hash: newHash } = splitPathAndHash(newPath)

      const markdownLinkRegex = new RegExp(`(?<!!)(\\[[^\\]]+\\])\\(([^)]+)\\)`, 'g')
      updatedContent = updatedContent.replace(markdownLinkRegex, (match, label, linkPath) => {
        if (!linkPath.startsWith('./') && !linkPath.startsWith('../')) return match

        const { path: linkBasePath, hash: linkHash } = splitPathAndHash(linkPath)
        if (resolveRelativeRoute(currentRoute, linkBasePath) !== oldBasePath) return match

        const finalHash = newHash || linkHash || ''
        return `${label}(${routeToRelativeLink(currentRoute, newBasePath)}${finalHash})`
      })

      const absoluteMarkdownLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapeRegExp(oldBasePath)}(?:#[^)]*)?\\)`, 'g')
      updatedContent = updatedContent.replace(absoluteMarkdownLinkRegex, (match, linkText) => {
        const existingHash = match.match(/#[^)]*(?=\))/)?.[0] || ''
        const finalHash = newHash || existingHash || ''
        return `[${linkText}](${newBasePath}${finalHash})`
      })

      const jsxLinkRegex = new RegExp(`(link=["'])(${escapeRegExp(oldBasePath)}(?:#[^"']*)?)(["'])`, 'g')
      updatedContent = updatedContent.replace(jsxLinkRegex, (_match, prefix, linkPath, suffix) => {
        const { hash: linkHash } = splitPathAndHash(linkPath)
        const finalHash = newHash || linkHash || ''
        return `${prefix}${newBasePath}${finalHash}${suffix}`
      })

      const arrayLinkRegex = new RegExp(`(link:\\s*["'])(${escapeRegExp(oldBasePath)}(?:#[^"']*)?)(["'])`, 'g')
      updatedContent = updatedContent.replace(arrayLinkRegex, (_match, prefix, linkPath, suffix) => {
        const { hash: linkHash } = splitPathAndHash(linkPath)
        const finalHash = newHash || linkHash || ''
        return `${prefix}${newBasePath}${finalHash}${suffix}`
      })

      const refDefRegex = new RegExp(
        `(^\\s*\\[[^\\]]+\\]:\\s*)(<?)(${escapeRegExp(oldBasePath)}(?:#[^\\s>"]*)?)(>?)((?:\\s+.+)?)$`,
        'gm',
      )
      updatedContent = updatedContent.replace(refDefRegex, (match, prefix, open, urlPath, close, trailing) => {
        const { path: defPath, hash: defHash } = splitPathAndHash(urlPath)
        if (defPath !== oldBasePath) return match
        const finalHash = newHash || defHash || ''
        return `${prefix}${open}${newBasePath}${finalHash}${close}${trailing || ''}`
      })
    })

    if (content !== updatedContent) {
      await fs.writeFile(filePath, updatedContent)
      console.log(`Updated links in ${filePath}`)
    }
  }

  const processDirectory = async (dir: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (dir === CONTENT_ROOT && (GENERATED_ROUTE_PREFIXES as readonly string[]).includes(`/${entry.name}`)) continue
        await processDirectory(fullPath)
      } else if (entry.name.endsWith('.mdx')) {
        await processFile(fullPath)
      }
    }
  }

  await processDirectory(CONTENT_ROOT)
}

const isGlobPattern = (pattern: string): boolean => {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[') || pattern.includes('{')
}

const globToDynamicPattern = (globPattern: string): string => {
  let result = globPattern
  result = result.replace(/\*\*/g, '__DOUBLE_STAR__')
  result = result.replace(/\*/g, '__SINGLE_STAR__')
  result = result.replace(/__DOUBLE_STAR__/g, ':path*')
  result = result.replace(/__SINGLE_STAR__/g, ':path*')
  return result
}

const globToRegex = (pattern: string): RegExp => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '([^/]*)')
    .replace(/§DOUBLESTAR§/g, '(.*?)')
    .replace(/\?/g, '([^/])')

  return new RegExp(`^${escaped}$`)
}

const mapSourceToDestination = (sourceFile: string, sourcePattern: string, destPattern: string): string => {
  const sourceRegex = globToRegex(sourcePattern)
  const matches = sourceFile.match(sourceRegex)

  if (!matches) {
    throw new Error(`Source file ${sourceFile} doesn't match pattern ${sourcePattern}`)
  }

  let result = destPattern
  let captureIndex = 1

  result = result.replace(/\*\*/g, () => matches[captureIndex++] || '')
  result = result.replace(/\*/g, () => matches[captureIndex++] || '')
  result = result.replace(/\?/g, () => matches[captureIndex++] || '')

  return result
}

const dynamicPatternToRegex = (dynamicPattern: string): RegExp => {
  const escaped = dynamicPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/:path\*/g, '(.*)')

  return new RegExp(`^${escaped}$`)
}

const updateStaticRedirectsForGlob = (
  redirects: Redirect[],
  sourcePattern: string,
  destPattern: string,
): Redirect[] => {
  const sourceDynamicRegex = dynamicPatternToRegex(globToDynamicPattern(sourcePattern))

  return redirects.map(redirect => {
    if (redirect.source.includes(':path*') || redirect.destination.includes(':path*')) return redirect

    const { path: sourcePath, hash: sourceHash } = splitPathAndHash(redirect.source)
    const { path: destPath, hash: destHash } = splitPathAndHash(redirect.destination)
    const sourceMatches = sourceDynamicRegex.test(sourcePath)
    const destMatches = sourceDynamicRegex.test(destPath)

    if (!sourceMatches && !destMatches) return redirect

    return {
      ...redirect,
      source: sourceMatches
        ? `${mapSourceToDestination(sourcePath, sourcePattern, destPattern)}${sourceHash}`
        : redirect.source,
      destination: destMatches
        ? `${mapSourceToDestination(destPath, sourcePattern, destPattern)}${destHash}`
        : redirect.destination,
      permanent: true,
    }
  })
}

const updateRedirects = async (
  oldPath: string,
  newPath: string,
  options: UpdateRedirectsOptions = {},
): Promise<string[]> => {
  const config = await readRedirectConfig()
  let redirects = config.redirects.map(redirect => ({ ...redirect, permanent: true }))

  if (options.glob) {
    const sourceDynamicPattern = globToDynamicPattern(oldPath)
    const destDynamicPattern = globToDynamicPattern(newPath)

    if (sourceDynamicPattern !== destDynamicPattern) {
      redirects.push({ source: sourceDynamicPattern, destination: destDynamicPattern, permanent: true })
      console.log(`Added dynamic redirect: ${sourceDynamicPattern} -> ${destDynamicPattern}`)
    } else {
      console.log(`Skipped redundant dynamic redirect: ${sourceDynamicPattern} -> ${destDynamicPattern}`)
    }

    redirects = updateStaticRedirectsForGlob(redirects, oldPath, newPath)
    redirects = dedupeRedirectsBySource(redirects)
    await writeRedirectConfig({ redirects })
    return [oldPath]
  }

  const { path: newPathBase, hash: newHash } = splitPathAndHash(newPath)
  const { path: oldPathBase } = splitPathAndHash(oldPath)
  const existingRedirect = redirects.find(redirect => {
    const { path: sourcePath } = splitPathAndHash(redirect.source)
    return sourcePath === oldPathBase
  })
  const redirectChain = findRedirectChain(redirects, oldPathBase)

  redirects = redirects.map(redirect => {
    const { path: destPath, hash: destHash } = splitPathAndHash(redirect.destination)

    if (destPath === oldPathBase) {
      return { ...redirect, destination: `${newPathBase}${newHash || destHash || ''}`, permanent: true }
    }

    return { ...redirect, permanent: true }
  })

  if (oldPath !== newPath) {
    redirects.push({ source: oldPath, destination: newPath, permanent: true })
  } else {
    console.log(`Skipped redundant static redirect: ${oldPath} -> ${newPath}`)
  }

  redirectChain.forEach(chainRedirect => {
    redirects = redirects.map(redirect => {
      const { path: sourcePath } = splitPathAndHash(redirect.source)
      const { path: chainSource } = splitPathAndHash(chainRedirect.source)

      if (sourcePath === chainSource) {
        const { hash: chainDestHash } = splitPathAndHash(chainRedirect.destination)
        const finalHash = newHash || chainDestHash || ''
        return { ...redirect, destination: `${newPathBase}${finalHash}`, permanent: true }
      }

      return redirect
    })
  })

  redirects = dedupeRedirectsBySource(redirects)
  await writeRedirectConfig({ redirects })

  const pathsToUpdate = [
    oldPath,
    ...(existingRedirect ? [existingRedirect.destination] : []),
    ...redirectChain.map(r => r.source),
  ]
  return [...new Set(pathsToUpdate.map(redirectPath => splitPathAndHash(redirectPath).path))]
}

const expandGlobPattern = async (pattern: string): Promise<string[]> => {
  const prefix = getRoutePrefix(pattern)
  const family = FAMILIES[prefix]
  const restPattern = pattern.slice(prefix.length).replace(/^\//, '')
  const filePattern = path.posix.join(CONTENT_ROOT, family, restPattern).replace(/\.mdx$/, '')
  const globPattern = filePattern.endsWith('**') ? `${filePattern}/*.mdx` : `${filePattern}.mdx`
  const files = await glob(globPattern, {
    cwd: process.cwd(),
    ignore: ['**/node_modules/**', '**/.git/**'],
  })

  return files.map(filePathToRoute).sort()
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

const moveFile = async (source: string, destination: string): Promise<void> => {
  if (source === destination) {
    console.log(`Skipped moving ${source} to itself`)
    return
  }

  const sourcePath = routeToFilePath(source)
  const destPath = routeToFilePath(destination)

  if (!(await fileExists(sourcePath))) {
    throw new Error(`Source path does not exist: ${sourcePath}`)
  }

  if ((await fs.stat(sourcePath)).isDirectory()) {
    throw new Error(`Source path must be a file: ${sourcePath}`)
  }

  if (await fileExists(destPath)) {
    throw new Error(`Destination path already exists: ${destPath}`)
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true })
  await fs.rename(sourcePath, destPath)
  console.log(`Moved ${sourcePath} to ${destPath}`)
}

export {
  moveFile,
  updateRedirects,
  updateSidebarDocIds,
  updateMdxLinks,
  routeToFilePath,
  filePathToRoute,
  routeToSidebarId,
  globToDynamicPattern,
  expandGlobPattern,
  mapSourceToDestination,
  isGlobPattern,
}

export async function moveDocuments(
  source: string,
  destination: string,
  options: MoveDocumentsOptions = {},
): Promise<MoveDocumentsResult> {
  const { verbose = true, dryRun = false } = options
  const isSourceGlob = isGlobPattern(source)
  const isDestGlob = isGlobPattern(destination)

  if (isSourceGlob || isDestGlob) {
    if (isSourceGlob && !isDestGlob) {
      throw new Error('If source is a glob pattern, destination must also be a glob pattern')
    }
    if (!isSourceGlob && isDestGlob) {
      throw new Error('If destination is a glob pattern, source must also be a glob pattern')
    }

    getRoutePrefix(source)
    getRoutePrefix(destination)

    if (verbose) console.log(`🔍 Expanding glob pattern: ${source}`)
    const sourceFiles = await expandGlobPattern(source)

    if (sourceFiles.length === 0) {
      if (verbose) console.log('❌ No files found matching the source pattern')
      return { success: false, message: 'No files found matching the source pattern', results: [] }
    }

    if (dryRun) {
      if (verbose) console.log('🔍 Dry run - showing what would be moved:')
      const results: MoveResult[] = sourceFiles.map(sourceFile => {
        const destFile = mapSourceToDestination(sourceFile, source, destination)
        if (verbose) console.log(`   ${sourceFile} → ${destFile}`)
        return { source: sourceFile, destination: destFile, status: 'would-move' }
      })
      return { success: true, message: `Dry run completed. Would move ${results.length} files`, results }
    }

    if (verbose) console.log(`🔄 Adding redirect for pattern: ${source} -> ${destination}`)
    await updateRedirects(source, destination, { glob: true })

    const results: MoveResult[] = []
    const movedRoutes: Array<{ source: string; destination: string }> = []
    for (const sourceFile of sourceFiles) {
      const destFile = mapSourceToDestination(sourceFile, source, destination)

      try {
        if (verbose) console.log(`   ${sourceFile} → ${destFile}`)
        await moveFile(sourceFile, destFile)
        await updateSidebarDocIds(sourceFile, destFile)
        movedRoutes.push({ source: sourceFile, destination: destFile })
        results.push({ source: sourceFile, destination: destFile, status: 'success' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (verbose) console.error(`❌ Failed to move ${sourceFile}: ${errorMessage}`)
        results.push({ source: sourceFile, destination: destFile, status: 'failed', error: errorMessage })
      }
    }

    for (const movedRoute of movedRoutes) {
      await updateMdxLinks([movedRoute.source], movedRoute.destination)
    }

    const successful = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'failed').length

    if (verbose) {
      console.log(`\n📊 Batch move completed: ${successful} successful, ${failed} failed`)
      if (successful > 0) console.log('Run `pnpm run generate-vercel-redirects` and commit vercel.json.')

      if (failed > 0) {
        console.log('\n❌ Failed moves:')
        results
          .filter(r => r.status === 'failed')
          .forEach(r => {
            console.log(`   ${r.source}: ${r.error}`)
          })
      }
    }

    return {
      success: failed === 0,
      message: `Batch move completed: ${successful} successful, ${failed} failed`,
      results,
    }
  }

  try {
    getRoutePrefix(source)
    getRoutePrefix(destination)

    if (dryRun) {
      if (verbose) console.log(`🔍 Dry run - would move: ${source} → ${destination}`)
      return {
        success: true,
        message: `Dry run completed. Would move ${source} to ${destination}`,
        results: [{ source, destination, status: 'would-move' }],
      }
    }

    await moveFile(source, destination)
    const pathsToUpdate = await updateRedirects(source, destination)
    await updateSidebarDocIds(source, destination)
    await updateMdxLinks(pathsToUpdate, destination)

    if (verbose) {
      console.log('Document move completed successfully')
      console.log('Run `pnpm run generate-vercel-redirects` and commit vercel.json.')
    }

    return {
      success: true,
      message: 'Document move completed successfully',
      results: [{ source, destination, status: 'success' }],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (verbose) console.error(`❌ Failed to move document: ${errorMessage}`)
    return {
      success: false,
      message: errorMessage,
      results: [{ source, destination, status: 'failed', error: errorMessage }],
    }
  }
}

const main = async (): Promise<void> => {
  const [source, destination] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))

  if (!source) {
    throw new Error('Source path is required')
  }

  if (!destination) {
    throw new Error('Destination path is required')
  }

  const result = await moveDocuments(source, destination, {
    verbose: !process.argv.includes('--silent'),
    dryRun: process.argv.includes('--dry-run'),
  })

  if (!result.success) {
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })
}
