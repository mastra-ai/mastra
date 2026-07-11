import * as React from 'react'
import { track } from '@vercel/analytics'

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
  identifier,
  description = 'Use this pre-built prompt to get started faster.',
}: {
  children: React.ReactNode
  identifier: string
  description?: string
}) {
  const [copied, setCopied] = React.useState<boolean>(false)
  const [open, setOpen] = React.useState<boolean>(false)
  const contentId = React.useId()
  const toggleId = React.useId()
  const statusId = React.useId()
  const promptText = React.useMemo(() => normalizePromptText(getNodeText(children)), [children])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptText)
      setCopied(true)
      setTimeout(setCopied, 2000, false)
      track('docs-copy_prompt', { identifier })
    } catch {
      // silently fail
    }
  }

  return (
    <div className="copy-prompt mb-4 rounded-xl border border-gray-300 px-4 py-2 shadow-sm dark:border-gray-700">
      <div className="flex items-center justify-between gap-4">
        <button
          id={toggleId}
          type="button"
          onClick={() => setOpen((current: boolean) => !current)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-start gap-4 text-left text-gray-600 transition-colors duration-200 hover:cursor-pointer hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        >
          <span
            aria-hidden="true"
            className="mt-2 inline-block h-2.5 w-2.5 shrink-0 origin-center border-r-2 border-b-2 border-current transition-transform duration-300"
            style={{ transform: open ? 'rotate(45deg)' : 'rotate(-45deg)' }}
          />
          <span>{description}</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-describedby={statusId}
          className="h-fit shrink-0 self-start rounded-xl bg-black px-3 py-1 font-semibold text-white transition-colors duration-300 hover:cursor-pointer hover:bg-gray-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:text-black"
        >
          {copied ? 'Copied!' : 'Copy prompt'}
        </button>
      </div>
      <p id={statusId} className="sr-only" aria-live="polite">
        {copied ? 'Prompt copied to clipboard.' : ''}
      </p>
      <div
        id={contentId}
        role="region"
        aria-labelledby={toggleId}
        hidden={!open}
        className="mt-3 [&>p:last-child]:mb-0!"
      >
        {children}
      </div>
    </div>
  )
}
