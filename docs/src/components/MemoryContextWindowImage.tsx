import React from 'react'
import { useColorMode } from '@docusaurus/theme-common'

export const MemoryContextWindowImage = () => {
  const { colorMode } = useColorMode()

  return (
    <div className="mt-4">
      <img
        src={
          colorMode === 'dark'
            ? '/img/memory/memory-context-window-dark.svg'
            : '/img/memory/memory-context-window-light.svg'
        }
        alt="Diagram showing how Mastra assembles the model context: system messages containing agent instructions, call-time system messages, working memory, cross-thread semantic recall, and Observational Memory, followed by conversation messages where message history and same-thread semantic recall interleave by timestamp, then call-time context messages, and finally the new user message"
        width={760}
        height={614}
      />
    </div>
  )
}

export default MemoryContextWindowImage
