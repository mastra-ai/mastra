/**
 * Deletes one Mastra documentation page and redirects its route to a replacement page.
 *
 * @example
 * pnpm tsx scripts/delete-doc.ts /docs/agents/old-page /docs/agents/replacement
 * pnpm tsx scripts/delete-doc.ts /docs/agents/old-page https://agents.example.com
 *
 * Use --dry-run to preview changes without making any modifications.
 *
 * The `.mdx` extension should be omitted. Sources and internal replacements support
 * the `/docs`, `/integrations`, and `/reference` route families. Replacements can also be
 * HTTPS URLs. Run `pnpm run generate-vercel-redirects` after a successful deletion
 * and commit the generated `vercel.json` update.
 */

import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'
import { isGlobPattern, routeToFilePath, routeToSidebarId, updateMdxLinks, updateRedirects } from './move-doc'

const CONTENT_ROOT = 'src/content/en'
const VERCEL_REDIRECTS_FILE = 'vercel.redirects.json'

const SIDEBAR_ROOTS = {
  docs: 'docsSidebar',
  integrations: 'integrationsSidebar',
  reference: 'referenceSidebar',
} as const

type Family = keyof typeof SIDEBAR_ROOTS

interface DeleteResult {
  source: string
  destination: string | null
  status: 'success' | 'failed' | 'would-delete'
  error?: string
}

interface DeleteDocumentResult {
  success: boolean
  message: string
  results: DeleteResult[]
}

interface DeleteDocumentOptions {
  verbose?: boolean
  dryRun?: boolean
}

interface NormalizedRoute {
  path: string
  hash: string
  full: string
}

type NormalizedDestination = { kind: 'route'; route: NormalizedRoute } | { kind: 'external'; full: string }

interface TextEdit {
  start: number
  end: number
}

interface SidebarAnalysis {
  content: string
  matched: number
}

interface ArrayAnalysis {
  removeSelf: boolean
  remaining: number
  matched: number
  edits: TextEdit[]
}

const normalizeRoute = (route: string): NormalizedRoute => {
  const hashIndex = route.indexOf('#')
  const routePath = hashIndex === -1 ? route : route.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : route.slice(hashIndex)
  const normalizedPath = routePath.length > 1 ? routePath.replace(/\/+$/, '') : routePath
  const segments = normalizedPath.split('/')
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Route must not contain dot segments: ${route}`)
  }
  if (segments.slice(1).some(segment => segment === '')) {
    throw new Error(`Route must not contain repeated slashes: ${route}`)
  }
  return { path: normalizedPath, hash, full: `${normalizedPath}${hash}` }
}

const normalizeDestination = (destination: string): NormalizedDestination => {
  if (!destination.includes('://')) return { kind: 'route', route: normalizeRoute(destination) }

  let url: URL
  try {
    url = new URL(destination)
  } catch {
    throw new Error(`Invalid replacement URL: ${destination}`)
  }

  if (url.protocol !== 'https:') throw new Error('External replacement URLs must use HTTPS')
  if (url.username || url.password) throw new Error('External replacement URLs must not include credentials')

  return { kind: 'external', full: url.href }
}

const routeFamily = (route: string): Family => {
  const relativePath = routeToFilePath(route).split(path.sep).join('/')
  const match = relativePath.match(/^src\/content\/en\/(docs|integrations|reference)\//)
  if (!match) throw new Error(`Could not resolve documentation family for ${route}`)
  return match[1] as Family
}

const assertFile = async (filePath: string, label: string): Promise<void> => {
  let stat
  try {
    stat = await fs.stat(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${label} path does not exist: ${filePath}`)
    }
    throw error
  }

  if (!stat.isFile()) throw new Error(`${label} path must be a file: ${filePath}`)
}

const propertyName = (property: ts.PropertyName | undefined): string | undefined => {
  if (!property) return undefined
  if (ts.isIdentifier(property) || ts.isStringLiteral(property) || ts.isNumericLiteral(property)) return property.text
  return undefined
}

const objectProperty = (object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== name) continue
    return property.initializer
  }
  return undefined
}

const stringValue = (expression: ts.Expression | undefined): string | undefined => {
  if (!expression) return undefined
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  return undefined
}

const isTargetDoc = (expression: ts.Expression, sidebarId: string): boolean => {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text === sidebarId
  }
  if (!ts.isObjectLiteralExpression(expression)) return false
  return (
    stringValue(objectProperty(expression, 'type')) === 'doc' &&
    stringValue(objectProperty(expression, 'id')) === sidebarId
  )
}

const categoryItems = (expression: ts.Expression): ts.ArrayLiteralExpression | undefined => {
  if (!ts.isObjectLiteralExpression(expression)) return undefined
  if (stringValue(objectProperty(expression, 'type')) !== 'category') return undefined
  const items = objectProperty(expression, 'items')
  return items && ts.isArrayLiteralExpression(items) ? items : undefined
}

const separatorComma = (sourceFile: ts.SourceFile, left: ts.Expression, right: ts.Expression): TextEdit => {
  const start = left.end
  const end = right.getStart(sourceFile)
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    sourceFile.text.slice(start, end),
  )

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.CommaToken) {
      const commaStart = start + scanner.getTokenPos()
      return { start: commaStart, end: commaStart + 1 }
    }
  }

  throw new Error('Could not locate a sidebar array separator comma')
}

const uniqueEdits = (edits: TextEdit[]): TextEdit[] => {
  const byRange = new Map(edits.map(edit => [`${edit.start}:${edit.end}`, edit]))
  const sorted = [...byRange.values()].sort((a, b) => a.start - b.start || a.end - b.end)

  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index].start < sorted[index - 1].end) {
      throw new Error('Calculated overlapping sidebar edits')
    }
  }

  return sorted
}

const analyzeArray = (
  array: ts.ArrayLiteralExpression,
  sourceFile: ts.SourceFile,
  sidebarId: string,
): ArrayAnalysis => {
  const removed = new Set<number>()
  const nestedEdits: TextEdit[] = []
  let matched = 0

  array.elements.forEach((element, index) => {
    if (ts.isSpreadElement(element)) {
      throw new Error('Sidebar arrays with spread elements cannot be edited safely')
    }

    if (isTargetDoc(element, sidebarId)) {
      removed.add(index)
      matched++
      return
    }

    const items = categoryItems(element)
    if (!items) return

    const nested = analyzeArray(items, sourceFile, sidebarId)
    matched += nested.matched
    if (nested.removeSelf) removed.add(index)
    else nestedEdits.push(...nested.edits)
  })

  if (removed.size === 0) {
    return { removeSelf: false, remaining: array.elements.length, matched, edits: nestedEdits }
  }

  const remaining = array.elements.length - removed.size
  const edits = [...nestedEdits]
  const removedIndices = [...removed].sort((a, b) => a - b)
  const runs: Array<{ start: number; end: number }> = []

  for (const index of removedIndices) {
    const current = runs.at(-1)
    if (current && current.end + 1 === index) current.end = index
    else runs.push({ start: index, end: index })
  }

  for (const run of runs) {
    for (let index = run.start; index <= run.end; index++) {
      const element = array.elements[index]
      edits.push({ start: element.getStart(sourceFile), end: element.end })
      if (index < run.end) edits.push(separatorComma(sourceFile, element, array.elements[index + 1]))
    }

    if (run.end < array.elements.length - 1) {
      edits.push(separatorComma(sourceFile, array.elements[run.end], array.elements[run.end + 1]))
    } else if (run.start > 0) {
      edits.push(separatorComma(sourceFile, array.elements[run.start - 1], array.elements[run.start]))
    }
  }

  return {
    removeSelf: remaining === 0 && array.elements.length > 0,
    remaining,
    matched,
    edits: uniqueEdits(edits),
  }
}

export const removeSidebarDocId = (content: string, family: Family, sidebarId: string): SidebarAnalysis => {
  const sourceFile = ts.createSourceFile('sidebars.js', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const parseDiagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  if (parseDiagnostics.length > 0) {
    throw new Error(
      `Could not parse sidebar: ${ts.flattenDiagnosticMessageText(parseDiagnostics[0].messageText, '\n')}`,
    )
  }

  const declarations: ts.VariableDeclaration[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'sidebars') {
      declarations.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  if (
    declarations.length !== 1 ||
    !declarations[0].initializer ||
    !ts.isObjectLiteralExpression(declarations[0].initializer)
  ) {
    throw new Error('Expected one sidebars object declaration')
  }

  const rootName = SIDEBAR_ROOTS[family]
  const roots = declarations[0].initializer.properties.filter(
    property => ts.isPropertyAssignment(property) && propertyName(property.name) === rootName,
  ) as ts.PropertyAssignment[]

  if (roots.length !== 1 || !ts.isArrayLiteralExpression(roots[0].initializer)) {
    throw new Error(`Expected one ${rootName} array in sidebars object`)
  }

  const analysis = analyzeArray(roots[0].initializer, sourceFile, sidebarId)
  if (analysis.matched === 0) return { content, matched: 0 }

  let updated = content
  for (const edit of uniqueEdits(analysis.edits).sort((a, b) => b.start - a.start)) {
    updated = `${updated.slice(0, edit.start)}${updated.slice(edit.end)}`
  }
  return { content: updated, matched: analysis.matched }
}

const listEditableMdxFiles = async (): Promise<string[]> => {
  const files: string[] = []

  const walk = async (directory: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(fullPath)
      else if (entry.isFile() && entry.name.endsWith('.mdx')) files.push(fullPath)
    }
  }

  for (const family of Object.keys(SIDEBAR_ROOTS)) await walk(path.join(CONTENT_ROOT, family))
  return files.sort()
}

const readOptionalFile = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

const restoreSnapshots = async (snapshots: Map<string, string>, mutationOrder: string[]): Promise<string[]> => {
  const failures: string[] = []
  const orderedPaths = [...mutationOrder].reverse()
  const remainingPaths = [...snapshots.keys()]
    .filter(filePath => !mutationOrder.includes(filePath))
    .sort()
    .reverse()
  const paths = [...new Set([...orderedPaths, ...remainingPaths])]

  for (const filePath of paths) {
    try {
      const current = await readOptionalFile(filePath)
      const original = snapshots.get(filePath)!
      if (current !== original) {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, original)
      }
    } catch (error) {
      failures.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return failures.sort()
}

export async function deleteDocument(
  source: string,
  destination: string,
  options: DeleteDocumentOptions = {},
): Promise<DeleteDocumentResult> {
  const { verbose = true, dryRun = false } = options
  let normalizedSource = source
  let normalizedDestination = destination
  const snapshots = new Map<string, string>()
  let mutationOrder: string[] = []
  let mutationStarted = false

  try {
    if (isGlobPattern(source)) throw new Error('Glob routes are not supported')

    const sourceRoute = normalizeRoute(source)
    const destinationValue = normalizeDestination(destination)
    const destinationRoute = destinationValue.kind === 'route' ? destinationValue.route : null
    const destinationFull = destinationValue.kind === 'route' ? destinationValue.route.full : destinationValue.full
    normalizedSource = sourceRoute.full
    normalizedDestination = destinationFull

    if (destinationRoute && isGlobPattern(destinationRoute.full)) throw new Error('Glob routes are not supported')
    if (sourceRoute.hash) throw new Error('Source route must not include a hash')
    if (destinationRoute && sourceRoute.path === destinationRoute.path) {
      throw new Error('Source and destination must be different routes')
    }

    const sourcePath = routeToFilePath(sourceRoute.path)
    const family = routeFamily(sourceRoute.path)
    const sidebarPath = path.join(CONTENT_ROOT, family, 'sidebars.js')
    const sidebarId = routeToSidebarId(sourceRoute.path)

    await assertFile(sourcePath, 'Source')
    if (destinationRoute) await assertFile(routeToFilePath(destinationRoute.path), 'Destination')

    const redirectContent = await fs.readFile(VERCEL_REDIRECTS_FILE, 'utf-8')
    const redirectConfig = JSON.parse(redirectContent)
    if (!redirectConfig || !Array.isArray(redirectConfig.redirects)) {
      throw new Error(`Expected redirects array in ${VERCEL_REDIRECTS_FILE}`)
    }

    const sidebarContent = await readOptionalFile(sidebarPath)
    const sidebarAnalysis = sidebarContent === null ? null : removeSidebarDocId(sidebarContent, family, sidebarId)
    const mdxFiles = await listEditableMdxFiles()

    snapshots.set(VERCEL_REDIRECTS_FILE, redirectContent)
    if (sidebarContent !== null) snapshots.set(sidebarPath, sidebarContent)
    for (const filePath of mdxFiles) snapshots.set(filePath, await fs.readFile(filePath, 'utf-8'))
    mutationOrder = [VERCEL_REDIRECTS_FILE, ...(sidebarAnalysis?.matched ? [sidebarPath] : []), ...mdxFiles, sourcePath]

    if (dryRun) {
      if (verbose) console.log(`Would delete ${sourceRoute.path} and redirect it to ${destinationFull}`)
      return {
        success: true,
        message: `Dry run completed. Would delete ${sourceRoute.path}`,
        results: [{ source: sourceRoute.path, destination: destinationFull, status: 'would-delete' }],
      }
    }

    mutationStarted = true
    const pathsToUpdate = await updateRedirects(sourceRoute.path, destinationFull, { verbose })

    if (sidebarAnalysis === null) {
      if (verbose) console.warn(`No sidebar file found at ${sidebarPath}; update sidebar manually if needed.`)
    } else if (sidebarAnalysis.matched === 0) {
      if (verbose) console.warn(`No sidebar id found for ${sidebarId} in ${sidebarPath}`)
    } else {
      await fs.writeFile(sidebarPath, sidebarAnalysis.content)
      if (verbose) console.log(`Removed sidebar id ${sidebarId} from ${sidebarPath}`)
    }

    await updateMdxLinks(pathsToUpdate, destinationFull, { verbose })
    await fs.unlink(sourcePath)

    if (verbose) {
      console.log(`Deleted ${sourcePath}`)
      console.log('Document deletion completed successfully')
      console.log('Run `pnpm run generate-vercel-redirects` and commit vercel.json.')
    }

    return {
      success: true,
      message: 'Document deletion completed successfully',
      results: [{ source: sourceRoute.path, destination: destinationFull, status: 'success' }],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    let finalMessage = errorMessage

    if (mutationStarted) {
      const rollbackFailures = await restoreSnapshots(snapshots, mutationOrder)
      if (rollbackFailures.length > 0) {
        finalMessage = `${errorMessage}. Rollback failed: ${rollbackFailures.join('; ')}`
      }
    }

    if (verbose) console.error(`Failed to delete document: ${finalMessage}`)
    return {
      success: false,
      message: finalMessage,
      results: [
        { source: normalizedSource, destination: normalizedDestination, status: 'failed', error: finalMessage },
      ],
    }
  }
}

const main = async (): Promise<void> => {
  const args = process.argv.slice(2)
  const supportedFlags = new Set(['--silent', '--dry-run'])
  const unknownFlag = args.find(argument => argument.startsWith('--') && !supportedFlags.has(argument))
  if (unknownFlag) throw new Error(`Unknown option: ${unknownFlag}`)

  const routes = args.filter(argument => !argument.startsWith('--'))
  if (!routes[0]) throw new Error('Source path is required')
  if (!routes[1]) throw new Error('Destination path is required')
  if (routes.length > 2) throw new Error(`Unexpected argument: ${routes[2]}`)

  const result = await deleteDocument(routes[0], routes[1], {
    verbose: !args.includes('--silent'),
    dryRun: args.includes('--dry-run'),
  })
  if (!result.success) process.exitCode = 1
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error)
    process.exitCode = 1
  })
}
