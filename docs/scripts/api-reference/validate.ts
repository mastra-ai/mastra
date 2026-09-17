import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { remarkApiReference, discoverSurfaces } from '../../src/plugins/remark-api-reference'
import { repositoryRoot, roots } from './config'

export async function validatePages(cwd = repositoryRoot, revision = process.env.API_REFERENCE_SOURCE_REVISION) {
  const content = join(cwd, 'docs/src/content/en/reference')
  const directory = mkdtempSync(join(tmpdir(), 'api-page-validation-'))
  const parser = unified().use(remarkParse).use(remarkMdx)
  const registry: Record<string, string> = {}
  const pages: { path: string; source: string }[] = []
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) scan(path)
      else if (entry.isFile() && entry.name.endsWith('.mdx')) {
        const source = readFileSync(path, 'utf8')
        if (!source.includes('<ApiReference')) continue
        const selections = discoverSurfaces(parser.parse(source))
        if (!selections.length) continue
        registry[path] = `/reference/${relative(content, path)
          .replaceAll('\\', '/')
          .replace(/\.mdx$/, '')}`
        pages.push({ path, source })
      }
    }
  }
  try {
    scan(content)
    for (const { page, id, section } of roots) {
      const path = join(content, page)
      const selections = discoverSurfaces(parser.parse(readFileSync(path, 'utf8')))
      if (selections.length !== 1 || selections[0]?.root.id !== id || selections[0]?.section !== section)
        throw new Error(`${page}: requires its complete source-backed ${section} surface`)
    }
    const routeRegistry = join(directory, 'routes.json')
    writeFileSync(routeRegistry, JSON.stringify(registry))
    for (const page of pages) {
      const transform = remarkApiReference({
        cwd,
        revision,
        production: true,
        routeRegistry,
        inputDirectory: join(cwd, 'docs/src/data/api-reference'),
        outputDirectory: join(directory, 'payloads'),
      })
      await transform(parser.parse(page.source), {
        path: page.path,
        message: message => console.warn(`${page.path}: ${message}`),
      })
    }
    return pages.map(page => relative(cwd, page.path))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validatePages()
    .then(pages => console.log(`Validated ${pages.length} source-backed reference pages without extraction`))
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
