import * as React from 'react'

function normalizePromptText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function getNodeText(node: React.ReactNode, parentTag?: string): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (!node || typeof node === 'boolean') {
    return ''
  }

  if (Array.isArray(node)) {
    return node.map(child => getNodeText(child, parentTag)).join('')
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    const tagName = typeof node.type === 'string' ? node.type : undefined
    const childrenText = getNodeText(node.props.children, tagName)

    if (tagName) {
      console.log(`Processing <${tagName}>: "${childrenText}"`)
      switch (tagName) {
        case 'br':
          return '\n'
        case 'p':
        case 'div':
        case 'section':
        case 'article':
        case 'blockquote':
          return `${childrenText}\n\n`
        case 'pre':
          return `\n\`\`\`\n${childrenText}\n\`\`\`\n\n`
        case 'code':
          return parentTag === 'pre' ? childrenText : `\`${childrenText}\``
        case 'li':
          return `- ${childrenText}\n`
        default:
          return childrenText
      }
    }

    return childrenText
  }

  return ''
}

export function CopyPrompt({
  children,
  description = 'Use this pre-built prompt to get started faster.',
}: {
  children: React.ReactNode
  description?: string
}) {
  const [copied, setCopied] = React.useState<boolean>(false)
  const [open, setOpen] = React.useState<boolean>(false)
  const promptText = React.useMemo(() => normalizePromptText(getNodeText(children)), [children])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptText)
      setCopied(true)
      setTimeout(setCopied, 2000, false)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-300 px-4 py-2 shadow-sm dark:border-gray-700">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((current: boolean) => !current)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-4 text-left text-gray-600 transition-colors duration-200 hover:cursor-pointer hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        >
          <span
            aria-hidden="true"
            className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 border-r-2 border-b-2 border-current transition-transform duration-300"
            style={{ transform: open ? 'rotate(45deg)' : 'rotate(-45deg)' }}
          />
          <span>{description}</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="h-fit shrink-0 self-start rounded-xl bg-black px-3 py-1 font-semibold text-white transition-colors duration-300 hover:cursor-pointer hover:bg-gray-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:text-black"
        >
          {copied ? 'Copied!' : 'Copy prompt'}
        </button>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
