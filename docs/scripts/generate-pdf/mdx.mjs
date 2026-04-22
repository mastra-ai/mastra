// MDX → plain-markdown preprocessor for the PDF generator.
// Strips imports, unwraps JSX components we care about (Tabs, Steps, CardGrid,
// admonitions, etc.), and leaves behind markdown that markdown-it can render.

import matter from 'gray-matter'

const JSX_COMPONENTS_TO_UNWRAP = new Set([
  'Tabs',
  'TabItem',
  'Steps',
  'StepItem',
  'CardGrid',
  'CardGridItem',
  'Step',
  'Callout',
  'FileTree',
])

const JSX_COMPONENTS_TO_STRIP = new Set([
  'YouTube',
  'PropertiesTable',
  'QuickstartPrompt',
  'StartCards',
  'Chat',
])

/**
 * Preprocess a raw .mdx file into markdown suitable for markdown-it.
 */
export function preprocessMdx(raw) {
  const parsed = matter(raw)
  let body = parsed.content

  body = stripImportsAndExports(body)
  // Steps / Tabs / CardGrid must run BEFORE admonitions, because the inner
  // content of those JSX blocks may itself contain admonitions, and inserting
  // an `<div>` at column 0 inside an indented Step would break the dedent
  // heuristic used to normalize fenced code blocks.
  body = convertSteps(body)
  body = convertTabs(body)
  body = convertCardGrids(body)
  body = convertAdmonitions(body)
  body = convertYouTube(body)
  body = convertPropertiesTables(body)
  body = stripRemainingJsxComponents(body)
  body = collapseBlankLines(body)

  return {
    data: parsed.data,
    content: body.trim(),
  }
}

function stripImportsAndExports(src) {
  return src
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('import ')) return false
      if (trimmed.startsWith('export default') || trimmed.startsWith('export const')) return false
      return true
    })
    .join('\n')
}

// :::note / :::tip / :::warning / :::info / :::danger  →  styled blockquote.
function convertAdmonitions(src) {
  const types = ['note', 'tip', 'warning', 'info', 'danger', 'caution']
  const labels = {
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
    info: 'Info',
    danger: 'Danger',
    caution: 'Caution',
  }

  for (const type of types) {
    const re = new RegExp(`:::${type}(?:\\[([^\\]]+)\\])?\\s*\\n([\\s\\S]*?)\\n?:::`, 'g')
    src = src.replace(re, (_m, customTitle, inner) => {
      const title = customTitle || labels[type]
      return `\n<div class="admonition admonition-${type}">\n\n**${title}**\n\n${inner.trim()}\n\n</div>\n`
    })
  }
  return src
}

// <CardGrid>…<CardGridItem title="X" href="/y" .../>…</CardGrid>  →  bullet list.
function convertCardGrids(src) {
  const cardItemRe = /<CardGridItem\b([^>]*?)(?:\/>|>([\s\S]*?)<\/CardGridItem>)/g
  const cardGridRe = /<CardGrid\b[^>]*>([\s\S]*?)<\/CardGrid>/g

  return src.replace(cardGridRe, (_m, inner) => {
    const items = []
    let match
    cardItemRe.lastIndex = 0
    while ((match = cardItemRe.exec(inner))) {
      const attrs = match[1]
      const title = extractAttr(attrs, 'title') || 'Link'
      const href = extractAttr(attrs, 'href') || ''
      items.push(href ? `- [${title}](${href})` : `- ${title}`)
    }
    return items.length ? `\n${items.join('\n')}\n` : ''
  })
}

// <Tabs>…<TabItem value="x" label="Y">inner</TabItem>…</Tabs>
// Render each tab as a small heading followed by its contents.
function convertTabs(src) {
  const tabsRe = /<Tabs\b[^>]*>([\s\S]*?)<\/Tabs>/g
  const tabItemRe = /<TabItem\b([^>]*)>([\s\S]*?)<\/TabItem>/g

  return src.replace(tabsRe, (_m, inner) => {
    let out = ''
    let match
    tabItemRe.lastIndex = 0
    while ((match = tabItemRe.exec(inner))) {
      const attrs = match[1]
      const content = dedent(match[2])
      const label = extractAttr(attrs, 'label') || extractAttr(attrs, 'value') || 'Option'
      out += `\n\n**${label}**\n\n${content}\n`
    }
    return out
  })
}

// <Steps>…<StepItem>inner</StepItem>…</Steps>  →  "Step N" headings followed
// by the verbatim content. Using numbered-list markdown would re-indent the
// body, which breaks fenced code blocks inside steps.
function convertSteps(src) {
  const stepsRe = /<Steps\b[^>]*>([\s\S]*?)<\/Steps>/g
  const stepItemRe = /<StepItem\b[^>]*>([\s\S]*?)<\/StepItem>/g

  return src.replace(stepsRe, (_m, inner) => {
    let n = 1
    let out = ''
    let match
    stepItemRe.lastIndex = 0
    while ((match = stepItemRe.exec(inner))) {
      const body = dedent(match[1])
      out += `\n\n<p class="step-label">Step ${n}</p>\n\n${body}\n\n`
      n++
    }
    return out
  })
}

// <YouTube id="abc"/>  →  markdown link.
function convertYouTube(src) {
  return src.replace(/<YouTube\b([^>]*?)\/>/g, (_m, attrs) => {
    const id = extractAttr(attrs, 'id')
    if (!id) return ''
    return `\n[Watch on YouTube → youtu.be/${id}](https://youtu.be/${id})\n`
  })
}

// <PropertiesTable content={[{...}]} />  →  best-effort markdown table.
// When the embedded array is complex JSX/JS, fall back to a short placeholder.
function convertPropertiesTables(src) {
  const re = /<PropertiesTable\b[\s\S]*?\/>/g
  return src.replace(re, (match) => {
    const rows = tryParsePropertyRows(match)
    if (!rows || rows.length === 0) {
      return '\n_(Property table omitted — see online reference.)_\n'
    }
    const header = '| Name | Type | Description |\n|------|------|-------------|'
    const body = rows
      .map(({ name, type, description, isOptional, defaultValue }) => {
        const opt = isOptional ? ' _(optional)_' : ''
        const def = defaultValue != null && defaultValue !== '' ? ` _Default: \`${defaultValue}\`_` : ''
        const desc = `${(description || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ')}${opt}${def}`.trim()
        const escName = `\`${(name || '').replace(/\|/g, '\\|')}\``
        const escType = `\`${(type || '').replace(/\|/g, '\\|')}\``
        return `| ${escName} | ${escType} | ${desc} |`
      })
      .join('\n')
    return `\n${header}\n${body}\n`
  })
}

// Very loose extraction for the common PropertiesTable pattern.
// Looks for `{ name: '...', type: '...', description: '...', isOptional: true, defaultValue: '...' }`.
function tryParsePropertyRows(src) {
  const objectRe = /\{\s*([\s\S]*?)\}/g
  const rows = []
  let match
  while ((match = objectRe.exec(src))) {
    const chunk = match[1]
    if (!/\bname\s*:/.test(chunk)) continue
    const row = {
      name: matchField(chunk, 'name'),
      type: matchField(chunk, 'type'),
      description: matchField(chunk, 'description'),
      isOptional: /isOptional\s*:\s*true/.test(chunk),
      defaultValue: matchField(chunk, 'defaultValue'),
    }
    if (row.name) rows.push(row)
  }
  return rows
}

function matchField(src, field) {
  const re = new RegExp(`${field}\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1).)*?)\\1`, 's')
  const m = re.exec(src)
  return m ? m[2].replace(/\\n/g, ' ').replace(/\\'/g, "'").replace(/\\"/g, '"') : ''
}

// Unwrap components inside JSX_COMPONENTS_TO_UNWRAP, strip components in
// JSX_COMPONENTS_TO_STRIP, and remove any leftover JSX tags whose name starts
// with an uppercase letter.
function stripRemainingJsxComponents(src) {
  // Drop self-closing tags for components we want to remove.
  src = src.replace(/<([A-Z][A-Za-z0-9]*)\b[^>]*\/>/g, (match, name) => {
    if (JSX_COMPONENTS_TO_STRIP.has(name)) return ''
    return ''
  })

  // Drop opening/closing tags for known wrapper components (keep inner text).
  src = src.replace(/<\/?([A-Z][A-Za-z0-9]*)\b[^>]*>/g, (match, name) => {
    if (JSX_COMPONENTS_TO_UNWRAP.has(name)) return ''
    if (JSX_COMPONENTS_TO_STRIP.has(name)) return ''
    // Unknown component — unwrap conservatively.
    return ''
  })

  // Drop leftover JSX expression braces that wrap pure strings, e.g. {' '}.
  src = src.replace(/\{\s*["'`][^"'`]*["'`]\s*\}/g, '')

  return src
}

function extractAttr(attrs, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`)
  const m = re.exec(attrs)
  if (!m) return ''
  const raw = m[1] ?? m[2] ?? m[3] ?? ''
  // Strip surrounding quotes if we grabbed a {"..."} expression.
  return raw.replace(/^['"`]|['"`]$/g, '').trim()
}

function collapseBlankLines(src) {
  return src.replace(/\n{3,}/g, '\n\n')
}

// Strip the common leading whitespace from every non-empty line. Used when
// extracting content from JSX children in the source MDX, where inner lines
// are often indented by 2 or 4 spaces; those indents would otherwise make
// markdown treat fenced code blocks as indented literal blocks.
function dedent(src) {
  const lines = src.replace(/^\n+/, '').replace(/\s+$/, '').split('\n')
  let min = Infinity
  for (const line of lines) {
    if (!line.trim()) continue
    const m = /^[ \t]*/.exec(line)
    const n = m ? m[0].length : 0
    if (n < min) min = n
  }
  if (!Number.isFinite(min) || min === 0) return lines.join('\n')
  return lines.map((l) => (l.length >= min ? l.slice(min) : l)).join('\n')
}
