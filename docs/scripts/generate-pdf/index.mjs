#!/usr/bin/env node
// Generates a single, printable PDF from the Mastra documentation.
//
// Usage:
//   node index.mjs                     # writes mastra-docs.pdf next to this script
//   node index.mjs --out path.pdf      # custom output path
//   node index.mjs --html-only         # emit only the intermediate HTML (for debugging)
//   node index.mjs --only docs,reference  # restrict the parts included
//
// Run `npm install` in this directory first to fetch puppeteer + markdown-it.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import hljs from 'highlight.js'

import { preprocessMdx } from './mdx.mjs'
import { loadSidebar, flattenSidebar } from './sidebar.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_DOCS_ROOT = path.resolve(__dirname, '../..')
const CONTENT_ROOT = path.join(REPO_DOCS_ROOT, 'src/content/en')
const STYLE_FILE = path.join(__dirname, 'style.css')

const DEFAULT_OUTPUT = path.join(__dirname, 'mastra-docs.pdf')

// Ordered list of top-level "parts". Each part corresponds to a sidebar
// config in a docs subdirectory. The order below is the order they appear
// in the final PDF.
const PARTS = [
  {
    id: 'get-started',
    title: 'Get Started',
    description: 'A warm welcome and a quick overview of Mastra.',
    contentDir: path.join(CONTENT_ROOT, 'docs'),
    docs: [{ id: 'index', label: 'Get Started' }],
  },
  {
    id: 'docs',
    title: 'Core Documentation',
    description: 'Concepts and how-to guides for building with Mastra.',
    sidebarFile: path.join(CONTENT_ROOT, 'docs', 'sidebars.js'),
    sidebarKey: 'docsSidebar',
    contentDir: path.join(CONTENT_ROOT, 'docs'),
    // Skip the root index, since it is already in "Get Started".
    skipIds: new Set(['index']),
  },
  {
    id: 'guides',
    title: 'Guides',
    description: 'End-to-end walkthroughs, integrations, and deployment recipes.',
    sidebarFile: path.join(CONTENT_ROOT, 'guides', 'sidebars.js'),
    sidebarKey: 'guidesSidebar',
    contentDir: path.join(CONTENT_ROOT, 'guides'),
  },
  {
    id: 'models',
    title: 'Model Providers & Gateways',
    description: 'Model routing, embeddings, and supported gateways.',
    sidebarFile: path.join(CONTENT_ROOT, 'models', 'sidebars.js'),
    sidebarKey: 'modelsSidebar',
    contentDir: path.join(CONTENT_ROOT, 'models'),
  },
  {
    id: 'reference',
    title: 'API Reference',
    description: 'Complete API documentation for every Mastra package.',
    sidebarFile: path.join(CONTENT_ROOT, 'reference', 'sidebars.js'),
    sidebarKey: 'referenceSidebar',
    contentDir: path.join(CONTENT_ROOT, 'reference'),
  },
]

function parseArgs(argv) {
  const args = { out: DEFAULT_OUTPUT, htmlOnly: false, only: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out' || a === '-o') args.out = path.resolve(argv[++i])
    else if (a === '--html-only') args.htmlOnly = true
    else if (a === '--only') args.only = new Set(argv[++i].split(',').map((s) => s.trim()))
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node index.mjs [--out path.pdf] [--html-only] [--only docs,reference]',
      )
      process.exit(0)
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log('Mastra Docs PDF generator')
  console.log('─'.repeat(40))

  const md = buildMarkdownIt()
  const usedSlugs = new Set()
  const toc = []
  const sections = []

  for (const part of PARTS) {
    if (args.only && !args.only.has(part.id)) continue

    console.log(`\n▸ Part: ${part.title}`)
    const tree = await resolvePartTree(part)
    const rendered = []
    const tocPart = { id: slugify(part.title, usedSlugs), title: part.title, children: [] }
    toc.push(tocPart)

    for (const node of tree) {
      await renderNode(node, {
        md,
        rendered,
        tocChildren: tocPart.children,
        usedSlugs,
        skipIds: part.skipIds,
      })
    }

    if (rendered.length === 0) {
      console.log('  (no docs found)')
      continue
    }

    sections.push({
      part,
      tocId: tocPart.id,
      body: rendered.join('\n'),
    })
    console.log(`  rendered ${rendered.length} sections`)
  }

  const html = buildHtml({ sections, toc, style: await fs.readFile(STYLE_FILE, 'utf8') })

  if (args.htmlOnly) {
    const outHtml = args.out.endsWith('.pdf') ? args.out.replace(/\.pdf$/, '.html') : args.out
    await fs.writeFile(outHtml, html, 'utf8')
    console.log(`\nWrote HTML → ${outHtml}`)
    return
  }

  console.log('\nStarting Puppeteer…')
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.emulateMediaType('print')
    await page.pdf({
      path: args.out,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate(),
      margin: { top: '22mm', bottom: '22mm', left: '18mm', right: '18mm' },
    })
  } finally {
    await browser.close()
  }

  const stat = await fs.stat(args.out)
  console.log(`\nDone. Wrote ${formatBytes(stat.size)} → ${args.out}`)
}

// ---------- Tree resolution ----------

async function resolvePartTree(part) {
  if (part.docs) {
    // Explicit list (used for the single-file "Get Started" part).
    return part.docs.map((d) => ({
      type: 'doc',
      id: d.id,
      label: d.label,
      file: path.join(part.contentDir, `${d.id}.mdx`),
      depth: 1,
    }))
  }
  const items = await loadSidebar(part.sidebarFile, part.sidebarKey)
  return flattenSidebar(items, { contentDir: part.contentDir })
}

async function renderNode(node, ctx) {
  if (node.type === 'category') {
    // Categories only appear in the TOC as a labelled group header; we no
    // longer emit a per-category body page since it would render as a nearly
    // blank sheet between the previous chapter and the category's first doc.
    const categoryToc = { title: node.label, depth: node.depth, children: [] }
    ctx.tocChildren.push(categoryToc)
    for (const child of node.children) {
      await renderNode(child, { ...ctx, tocChildren: categoryToc.children })
    }
    return
  }
  if (node.type === 'doc') {
    if (ctx.skipIds && ctx.skipIds.has(node.id)) return
    await renderDoc(node, ctx)
  }
}

async function renderDoc(doc, ctx) {
  let raw
  try {
    raw = await fs.readFile(doc.file, 'utf8')
  } catch (err) {
    console.warn(`  ! missing: ${doc.file}`)
    return
  }
  const { data, content } = preprocessMdx(raw)
  const title = doc.label || data.title || doc.id
  const slug = slugify(`${doc.id}-${title}`, ctx.usedSlugs)

  ctx.tocChildren.push({ id: slug, title: stripTitleDecoration(title), depth: doc.depth })

  const header =
    `<section class="chapter-header" id="${slug}">` +
    `<div class="chapter-eyebrow">${escapeHtml(doc.id.split('/')[0] || 'Doc')}</div>` +
    `<h2>${escapeHtml(stripTitleDecoration(title))}</h2>` +
    (data.description ? `<div class="chapter-description">${escapeHtml(data.description)}</div>` : '') +
    `</section>`

  const body = ctx.md.render(content)
  ctx.rendered.push(`${header}\n<article>${body}</article>`)
}

// ---------- HTML assembly ----------

function buildHtml({ sections, toc, style }) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const tocHtml = renderToc(toc)
  // Part headers used to be full-page title sheets (mostly blank). They added
  // little beyond what the TOC already conveys and disrupted the reading flow,
  // so body rendering now goes straight into the first chapter of each part.
  const body = sections.map((s) => s.body).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mastra Documentation</title>
<style>${style}</style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="cover-eyebrow">The Mastra Framework</div>
      <div class="cover-title">Mastra<br/>Documentation</div>
      <div class="cover-subtitle">The complete printable reference — core framework, guides, API reference, model gateways, and more.</div>
    </div>
    <div class="cover-meta">
      <strong>Generated</strong> ${today} · <strong>Source</strong> mastra-ai/mastra · <strong>Format</strong> one-file print
    </div>
  </section>
  <section class="toc" id="table-of-contents">
    <h1>Contents</h1>
    ${tocHtml}
  </section>
  ${body}
</body>
</html>`
}

function renderToc(entries) {
  const lines = ['<ol>']
  for (const part of entries) {
    // Parts no longer have a body anchor, so render the label as plain text.
    lines.push(`<li class="toc-part">${escapeHtml(part.title)}</li>`)
    lines.push(...renderTocChildren(part.children, 'toc-chapter'))
  }
  lines.push('</ol>')
  return lines.join('\n')
}

function renderTocChildren(children, cls) {
  const out = []
  for (const child of children || []) {
    const childCls = cls === 'toc-chapter' && child.children ? 'toc-chapter' : cls
    const itemCls = child.children ? 'toc-chapter' : childCls
    const label = escapeHtml(child.title)
    // Categories have no id (they're just visual grouping), so render the
    // label as plain text instead of a broken anchor.
    const inner = child.id ? `<a href="#${child.id}">${label}</a>` : label
    out.push(`<li class="${itemCls}">${inner}</li>`)
    if (child.children && child.children.length) {
      out.push(...renderTocChildren(child.children, 'toc-section'))
    }
  }
  return out
}

// ---------- Markdown rendering ----------

function buildMarkdownIt() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: true,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        } catch {
          /* fall through */
        }
      }
      return escapeHtml(str)
    },
  })

  md.use(anchor, {
    permalink: false,
    slugify: (s) => simpleSlug(s),
  })

  // Custom fence rendering so we can honour Docusaurus fence metadata such as
  // `title="src/foo.ts"` and `{1,3-5}` highlight ranges.
  const defaultFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]
    const info = (token.info || '').trim()
    const { lang, title } = parseFenceInfo(info)
    token.info = lang // reset so the base renderer picks up only the language.

    const base = defaultFence
      ? defaultFence(tokens, idx, opts, env, self)
      : `<pre><code>${escapeHtml(token.content)}</code></pre>`

    if (!title) return `<div class="code-block">${base}</div>`
    return `<div class="code-block has-title"><div class="code-block-title">${escapeHtml(title)}</div>${base}</div>`
  }

  return md
}

function parseFenceInfo(info) {
  // Examples:
  //   typescript title="src/mastra/index.ts"
  //   typescript {2,5-7}
  //   bash npm2yarn
  //   typescript title="x.ts" {2}
  const parts = info.split(/\s+/).filter(Boolean)
  const lang = parts.shift() || ''
  let title = ''
  const titleRe = /^title=(["'])(.*)\1$/
  for (const p of parts) {
    const m = titleRe.exec(p)
    if (m) title = m[2]
  }
  // Grab bare title="..." that had a space inside quotes (rare but possible).
  const bareTitle = /title=(["'])([^"']+)\1/.exec(info)
  if (!title && bareTitle) title = bareTitle[2]
  return { lang, title }
}

// ---------- Utilities ----------

function slugify(str, usedSlugs) {
  let slug = simpleSlug(str)
  if (!usedSlugs) return slug
  let candidate = slug
  let n = 2
  while (usedSlugs.has(candidate)) {
    candidate = `${slug}-${n++}`
  }
  usedSlugs.add(candidate)
  return candidate
}

function simpleSlug(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function stripTitleDecoration(title) {
  // Drop the trailing " | Category" Docusaurus convention so headings read cleanly.
  return String(title).replace(/\s*\|\s*[^|]+$/, '').replace(/^Reference:\s*/i, '')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function footerTemplate() {
  return `
  <style>
    .pdf-footer {
      width: 100%;
      font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 8pt;
      color: #8a8f98;
      padding: 0 18mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
  <div class="pdf-footer">
    <span>Mastra Documentation</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
