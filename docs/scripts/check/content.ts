import fs from 'fs/promises'
import path from 'path'
import { parse as parseYaml, YAMLParseError } from 'yaml'
import { extractFrontMatterBounds, normalizeContent } from '../../src/utils/frontmatter'
import type { ContentFile } from './types'

export const CONTENT_ROOT = 'src/content/en'

/** Content sections and the route each one is served from. */
export const CONTENT_SECTIONS = [
  { name: 'docs', route: '/docs' },
  { name: 'integrations', route: '/integrations' },
  { name: 'models', route: '/models' },
  { name: 'reference', route: '/reference' },
] as const

export async function walkMdx(dir: string): Promise<string[]> {
  const results: string[] = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }
  await Promise.all(
    entries.map(async entry => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) results.push(...(await walkMdx(full)))
      else if (entry.name.endsWith('.mdx')) results.push(full)
    }),
  )
  return results.sort()
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

export function parseContentFile(rootDir: string, relativePath: string, raw: string): ContentFile {
  const posixPath = toPosix(relativePath)
  const section = posixPath.startsWith(`${CONTENT_ROOT}/`) ? posixPath.slice(CONTENT_ROOT.length + 1).split('/')[0] : ''
  const source = normalizeContent(raw)
  const bounds = extractFrontMatterBounds(source)
  const file: ContentFile = {
    path: posixPath,
    absolutePath: path.join(rootDir, relativePath),
    section,
    source,
    frontmatter: null,
    bodyStartLine: bounds ? bounds.endLine + 1 : 1,
    lintDisable: [],
  }
  if (!bounds) return file

  try {
    const data = parseYaml(bounds.rawContent)
    file.frontmatter = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch (error) {
    const line =
      error instanceof YAMLParseError && error.linePos ? bounds.contentStartLine + error.linePos[0].line - 1 : undefined
    file.frontmatterError = { message: error instanceof Error ? error.message.split('\n')[0] : String(error), line }
    return file
  }

  const lintDisable = file.frontmatter.lintDisable
  if (Array.isArray(lintDisable)) {
    file.lintDisable = lintDisable.filter((v): v is string => typeof v === 'string')
  }
  return file
}

export async function loadContentFile(rootDir: string, relativePath: string): Promise<ContentFile> {
  const raw = await fs.readFile(path.join(rootDir, relativePath), 'utf-8')
  return parseContentFile(rootDir, relativePath, raw)
}

export async function loadAllContentFiles(rootDir: string): Promise<ContentFile[]> {
  const files = (
    await Promise.all(CONTENT_SECTIONS.map(section => walkMdx(path.join(rootDir, CONTENT_ROOT, section.name))))
  ).flat()
  return Promise.all(files.map(file => loadContentFile(rootDir, path.relative(rootDir, file))))
}

/** 1-based line number of the first frontmatter line that starts with `key:`. */
export function frontmatterKeyLine(file: ContentFile, key: string): number | undefined {
  const lines = file.source.split('\n')
  for (let i = 1; i < file.bodyStartLine - 1; i++) {
    if (lines[i].startsWith(`${key}:`)) return i + 1
  }
  return undefined
}

/** True for partials and templates (`_partial.mdx`, `_template.mdx`), which do not produce routes. */
export function isPartial(file: Pick<ContentFile, 'path'>): boolean {
  return file.path.split('/').some(segment => segment.startsWith('_'))
}
