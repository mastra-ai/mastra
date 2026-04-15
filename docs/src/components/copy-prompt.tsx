import * as React from 'react'

const FILE_NAMES = ['quickstart'] as const
type PromptName = (typeof FILE_NAMES)[number]

const cache = new Map<string, string>()

export function CopyPrompt({
  name,
  description = 'Use this pre-built prompt to get started faster.',
}: {
  name: PromptName
  description?: string
}) {
  if (!FILE_NAMES.includes(name)) {
    throw new Error(`Invalid prompt name: ${name}`)
  }

  const url = typeof window !== 'undefined' ? `${window.location.origin}/prompts/${name}.txt` : `/prompts/${name}.txt`
  const [copied, setCopied] = React.useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': cache.has(url)
            ? new Blob([cache.get(url)!], { type: 'text/plain' })
            : fetch(url).then(async res => {
                const content = await res.text()
                cache.set(url, content)
                return new Blob([content], { type: 'text/plain' })
              }),
        }),
      ])
      setCopied(true)
      setTimeout(setCopied, 2000, false)
    } catch {
      // silently fail
    }
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-300 px-4 py-2 shadow-sm dark:border-gray-700">
      <div className="text-gray-600 dark:text-gray-300">{description}</div>
      <button
        onClick={handleCopy}
        className="rounded-xl bg-black px-3 py-1 font-semibold text-white transition-colors duration-200 hover:cursor-pointer hover:bg-gray-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:text-black"
      >
        {copied ? 'Copied!' : 'Copy prompt'}
      </button>
    </div>
  )
}
