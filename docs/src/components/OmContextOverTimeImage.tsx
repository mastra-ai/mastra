import React from 'react'
import { useColorMode } from '@docusaurus/theme-common'

export const OmContextOverTimeImage = () => {
  const { colorMode } = useColorMode()

  return (
    <div className="mt-4">
      <img
        src={
          colorMode === 'dark'
            ? '/img/memory/om-context-over-time-dark.svg'
            : '/img/memory/om-context-over-time-light.svg'
        }
        alt="Chart of context tokens over the course of a conversation with Observational Memory enabled: message history repeatedly grows toward the 30,000 token observation threshold, then shrinks back to around 6,000 tokens as observations activate, while the observation log steps up with each cycle until it reaches the 40,000 token reflection threshold and the Reflector condenses it into reflections"
        width={760}
        height={500}
      />
    </div>
  )
}

export default OmContextOverTimeImage
