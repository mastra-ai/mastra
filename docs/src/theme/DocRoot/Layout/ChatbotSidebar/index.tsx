import { Markdown } from '@copilotkit/react-ui'
import { prefersReducedMotion } from '@docusaurus/theme-common'
import { useChat } from '@kapaai/react-sdk'
import { Button } from '@site/src/components/ui/button'
import { Conversation, ConversationContent, ConversationScrollButton } from '@site/src/components/ui/conversation'
import { Textarea } from '@site/src/components/ui/textarea'
import { cn } from '@site/src/lib/utils'
import clsx from 'clsx'
import { ArrowUp, PanelLeftClose, PanelRightClose, Square, ThumbsDown, ThumbsUp } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useChatbotSidebar } from './context'
import styles from './styles.module.css'

function LeftClickableBorder({
  toggleSidebar,
  hiddenChatbotSidebar,
}: {
  toggleSidebar: () => void
  hiddenChatbotSidebar: boolean
}) {
  return (
    <div
      className="absolute top-0 bottom-0 -left-2 z-100 h-full w-4 cursor-col-resize"
      onClick={toggleSidebar}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleSidebar()
        }
      }}
      title={hiddenChatbotSidebar ? 'Expand chatbot' : 'Collapse chatbot'}
      aria-label={hiddenChatbotSidebar ? 'Expand chatbot' : 'Collapse chatbot'}
    />
  )
}

export default function ChatbotSidebar() {
  const { isHidden: hiddenChatbotSidebar, toggle } = useChatbotSidebar()
  const [hiddenSidebar, setHiddenSidebar] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!hiddenChatbotSidebar) {
      // Use setTimeout to ensure the textarea is rendered and ready
      const timeoutId = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [hiddenChatbotSidebar])

  const toggleSidebar = useCallback(() => {
    if (hiddenSidebar) {
      setHiddenSidebar(false)
    }
    // onTransitionEnd won't fire when sidebar animation is disabled
    // fixes https://github.com/facebook/docusaurus/issues/8918
    if (!hiddenSidebar && prefersReducedMotion()) {
      setHiddenSidebar(true)
    }
    toggle()
  }, [toggle, hiddenSidebar])

  const { conversation, submitQuery, isGeneratingAnswer, isPreparingAnswer, stopGeneration, addFeedback } = useChat()
  const [inputValue, setInputValue] = useState('')

  const isLoading = isGeneratingAnswer || isPreparingAnswer
  const isDisabled = inputValue.trim() === '' || isLoading

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      submitQuery(inputValue)
      setInputValue('')
      // Refocus textarea after submission
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim()) {
        submitQuery(inputValue)
        setInputValue('')
        // Refocus textarea after submission
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 0)
      }
    }
  }

  const handleFeedback = (questionAnswerId: string, reaction: 'upvote' | 'downvote') => {
    addFeedback(questionAnswerId, reaction)
  }

  // Set global CSS variable when chatbot sidebar open/close state changes
  useEffect(() => {
    document.documentElement.style.setProperty('--chatbot-sidebar-open', hiddenChatbotSidebar ? '0' : '1')
  }, [hiddenChatbotSidebar])

  return (
    <aside
      className={clsx(styles.chatbotSidebarContainer, hiddenChatbotSidebar && styles.chatbotSidebarContainerHidden)}
    >
      <LeftClickableBorder toggleSidebar={toggleSidebar} hiddenChatbotSidebar={hiddenChatbotSidebar} />

      {hiddenChatbotSidebar ? (
        <div
          className={cn(
            'relative z-10 flex h-full flex-col items-center justify-start gap-2 bg-(--ifm-navbar-background-color) px-2 py-2 pt-1 backdrop-blur-md',
          )}
        >
          <button
            className={cn(
              'absolute top-1/2 h-fit w-fit -translate-y-1/2 cursor-pointer rounded-lg p-1.5 hover:bg-(--mastra-surface-1)',
            )}
            onClick={toggleSidebar}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {!hiddenChatbotSidebar && (
        <div className="flex h-[calc(100%-165px)] flex-col">
          <div className="absolute top-0 z-200 flex w-full items-center border-b-[0.5px] border-(--border) bg-white/50 p-2 py-2 text-sm font-medium text-(--mastra-text-tertiary) backdrop-blur-md dark:bg-black">
            <button
              className={cn('mr-2 w-fit cursor-pointer rounded-lg p-1.5 hover:bg-(--mastra-surface-1)')}
              onClick={toggleSidebar}
            >
              <PanelRightClose className="size-4" />
            </button>
            <span>Chat with Mastra docs</span>
          </div>
          <Conversation className="relative mt-[41px] flex-1 overflow-y-auto font-sans">
            <ConversationContent>
              {conversation.length > 0
                ? conversation.map(({ answer: a, question: q, id, reaction }) => {
                    return (
                      <div key={id} className={`flex w-full flex-col gap-8`}>
                        {!!q && (
                          <div className="dark:bg-surface-3 dark:text-icons-6 max-w-[80%] self-end rounded-xl bg-(--mastra-surface-3) px-2 py-1 text-sm text-(--light-color-text-4)">
                            {q}
                          </div>
                        )}

                        {!!a && (
                          <div className="dark:text-icons-6 relative max-w-full bg-transparent text-sm text-[--light-color-text-4]">
                            <Markdown content={a} />
                            {/* Feedback buttons - only show when answer is complete */}
                            {id && (
                              <div className="mt-3 flex items-center gap-2">
                                <span className="text-icons-2 text-xs">Was this helpful?</span>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleFeedback(id, 'upvote')}
                                  className={`cursor-pointer p-1 ${
                                    reaction === 'upvote'
                                      ? 'text-(--mastra-green-accent) dark:text-(--mastra-green-accent)'
                                      : 'dark:text-icons-3 text-(--mastra-text-tertiary)'
                                  }`}
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleFeedback(id, 'downvote')}
                                  className={`cursor-pointer p-1 ${
                                    reaction === 'downvote'
                                      ? 'text-red-600 dark:text-red-500'
                                      : 'dark:text-icons-3 text-(--mastra-text-tertiary)'
                                  }`}
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                : null}
              {true && <div className="animate-pulse font-mono text-xs">Generating answer...</div>}
            </ConversationContent>
            <ConversationScrollButton className="border-none bg-white/50 ring-1 ring-(--border-subtle) backdrop-blur-lg dark:bg-black/50" />
          </Conversation>
        </div>
      )}
      {!hiddenChatbotSidebar && (
        <div className="z-10 space-y-2.5 bg-(--ifm-navbar-background-color) px-2 pt-2 backdrop-blur-lg">
          <form
            className="flex flex-col rounded-2xl border border-(--border) bg-(--ifm-background-color) p-3 shadow-[0px_10px_24px_-6px_#0000001a,0px_2px_4px_-1px_#0000000f,0_0_0_1px_#54483114] focus-within:border-green-500 focus-within:ring-2 focus-within:ring-(--mastra-green-accent)/50"
            onSubmit={handleSubmit}
          >
            <Textarea
              className="text-foreground w-full resize-none overflow-hidden border-none p-0 text-sm font-medium shadow-none outline-none placeholder:font-medium placeholder:text-(--mastra-text-muted) focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
              placeholder="Ask questions about Mastra..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              ref={textareaRef}
              autoFocus
            />
            <div className="flex w-full justify-end">
              {!isLoading ? (
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isDisabled}
                  className="cursor-pointer self-end rounded-full bg-black ring-3 ring-black/10 ring-offset-1 ring-offset-white will-change-transform hover:scale-105 hover:bg-black/90 dark:bg-white dark:hover:bg-white/90"
                >
                  <ArrowUp className="h-4 w-4 text-white dark:text-black" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={stopGeneration}
                  className="cursor-pointer self-end rounded-full bg-black ring-3 ring-black/10 ring-offset-1 ring-offset-white will-change-transform hover:scale-105 hover:bg-black/90 dark:bg-white dark:hover:bg-white/90"
                >
                  <Square className="h-3 w-3 fill-white text-white dark:text-black" />
                </Button>
              )}
            </div>
          </form>
          <div className="flex items-end px-3 pt-0 pb-3">
            <span className="ml-auto inline-block text-[11px] font-medium text-(--mastra-text-muted-2)! dark:text-(--mastra-text-tertiary)">
              Powered by{' '}
              <a
                href="https://kapa.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--mastra-text-muted-2)! dark:text-(--mastra-text-tertiary)"
              >
                kapa.ai
              </a>
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}
