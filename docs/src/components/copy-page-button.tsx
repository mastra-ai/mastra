import { cn } from '@site/src/lib/utils'
import { useCallback, useState } from 'react'
import { useMarkdownContent } from '../hooks/useMarkdownContent'
import { ChatGPTIcon, ChevronDownIcon, ClaudeIcon, CopyPageIcon, CursorIcon, ExternalLinkIcon } from './copy-page-icons'
import { Button } from './ui/button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

function openInChatGpt(url: string, encodeURIComponent: typeof window.encodeURIComponent) {
  const query = encodeURIComponent(`Read from the ${url} so I can ask questions about it.`)
  const chatGptUrl = `https://chatgpt.com/?hints=search&q=${query}`
  return chatGptUrl
}

function openInClaude(url: string, encodeURIComponent: typeof window.encodeURIComponent) {
  const query = encodeURIComponent(`Read from the ${url} so I can ask questions about it.`)
  const claudeUrl = `https://claude.ai/new?q=${query}`
  return claudeUrl
}

function openInCursor() {
  const cursorUrl =
    'cursor://anysphere.cursor-deeplink/mcp/install?name=mastra&config=eyJjb21tYW5kIjoibnB4IC15IEBtYXN0cmEvbWNwLWRvY3Mtc2VydmVyIn0%3D'
  return cursorUrl
}

function openWindow(url: string) {
  window.open(url, '_blank')
}

// TODO: Do not hide this button in some viewports

export const CopyPageButton = () => {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { getMarkdownContent } = useMarkdownContent()
  const content = getMarkdownContent()

  const handleCopyPage = useCallback(async () => {
    const content = getMarkdownContent()
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  const handleOpenInChatGPT = () => {
    const currentUrl = window.location.href
    const chatGptUrl = openInChatGpt(currentUrl, encodeURIComponent)
    openWindow(chatGptUrl)
  }

  const handleOpenInClaude = () => {
    const currentUrl = window.location.href
    const claudeUrl = openInClaude(currentUrl, encodeURIComponent)
    openWindow(claudeUrl)
  }

  const handleOpenInCursor = () => {
    const cursorUrl = openInCursor()
    openWindow(cursorUrl)
  }

  return (
    <div className="flex items-center" data-copy-page-button>
      <Button
        variant="ghost"
        onClick={handleCopyPage}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-xl rounded-tr-none rounded-br-none border border-r-0 border-(--border)/50 px-3 py-1.5 text-[13px] font-normal',
          'hover:bg-(--mastra-surface-2)',
        )}
      >
        <CopyPageIcon className="size-3" />
        <span>{copied ? 'Copied' : 'Copy page'}</span>
      </Button>

      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'inline-flex h-8 items-center justify-center rounded-xl rounded-tl-none rounded-bl-none p-1.5 px-2.5',
              'border border-(--border)/50 hover:bg-(--mastra-surface-2) dark:border-(--border)/50',
            )}
            aria-label="Show more options"
          >
            <ChevronDownIcon
              className={cn('size-3 transition-transform duration-200', open && 'rotate-180 transform')}
            />
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={cn(
              'min-w-[280px] rounded-xl bg-(--ifm-background-color) dark:bg-(--mastra-surface-3)',
              'border border-(--border)/50 dark:border-(--border)',
              'z-50 p-1',
              'animate-in fade-in-0 zoom-in-95',
            )}
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Item
              className={cn(
                'group flex items-center gap-3 px-2 py-2 text-sm',
                'text-(--mastra-text-secondary) dark:text-white',
                'cursor-pointer rounded-lg outline-none',
                'hover:bg-(--mastra-surface-2) dark:hover:bg-(--mastra-surface-5)/50',
                'focus:bg-(--mastra-surface-2)',
                'transition-colors duration-150',
              )}
              onClick={handleCopyPage}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/50 bg-(--mastra-surface-2) dark:border-(--border) dark:bg-(--mastra-surface-5)">
                <CopyPageIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="font-medium">Copy page</div>
                <div className="text-xs text-(--mastra-text-primary) dark:text-(--mastra-text-tertiary)">
                  Copy page as Markdown for LLMs
                </div>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-3 p-2 text-sm',
                'text-(--mastra-text-secondary) dark:text-white',
                'cursor-pointer rounded-lg outline-none',
                'hover:bg-(--mastra-surface-2) dark:hover:bg-(--mastra-surface-5)/50',
                'focus:bg-(--mastra-surface-2)',
                'transition-colors duration-150',
              )}
              onClick={handleOpenInChatGPT}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/50 bg-(--mastra-surface-2) dark:border-(--border) dark:bg-(--mastra-surface-5)">
                <ChatGPTIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5 font-medium">
                  Open in ChatGPT
                  <ExternalLinkIcon className="h-3 w-3" />
                </div>
                <div className="text-xs text-(--mastra-text-primary) dark:text-(--mastra-text-tertiary)">
                  Ask questions about this page
                </div>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-3 p-2 text-sm',
                'text-(--mastra-text-secondary) dark:text-white',
                'cursor-pointer rounded-lg outline-none',
                'hover:bg-(--mastra-surface-2) dark:hover:bg-(--mastra-surface-5)/50',
                'focus:bg-(--mastra-surface-2)',
                'transition-colors duration-150',
              )}
              onClick={handleOpenInClaude}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/50 bg-(--mastra-surface-2) dark:border-(--border) dark:bg-(--mastra-surface-5)">
                <ClaudeIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5 font-medium">
                  Open in Claude
                  <ExternalLinkIcon className="h-3 w-3" />
                </div>
                <div className="text-xs text-(--mastra-text-primary) dark:text-(--mastra-text-tertiary)">
                  Ask questions about this page
                </div>
              </div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-3 p-2 text-sm',
                'text-(--mastra-text-secondary) dark:text-white',
                'cursor-pointer rounded-lg outline-none',
                'hover:bg-(--mastra-surface-2) dark:hover:bg-(--mastra-surface-5)/50',
                'focus:bg-(--mastra-surface-2)',
                'transition-colors duration-150',
              )}
              onClick={handleOpenInCursor}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/50 bg-(--mastra-surface-2) dark:border-(--border) dark:bg-(--mastra-surface-5)">
                <CursorIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5 font-medium">
                  Connect to Cursor
                  <ExternalLinkIcon className="h-3 w-3" />
                </div>
                <div className="text-xs text-(--mastra-text-primary) dark:text-(--mastra-text-tertiary)">
                  Install MCP Server on Cursor
                </div>
              </div>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
