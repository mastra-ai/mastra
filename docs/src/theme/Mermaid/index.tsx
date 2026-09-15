import React, { useEffect, useMemo, useRef, type ReactNode } from 'react'
import ErrorBoundary from '@docusaurus/ErrorBoundary'
import { ErrorBoundaryErrorMessageFallback, useColorMode } from '@docusaurus/theme-common'
import { MermaidContainerClassName, useMermaidRenderResult } from '@docusaurus/theme-mermaid/client'
import type { Props } from '@theme/Mermaid'
import type { RenderResult } from 'mermaid'
import { mastraMermaidConfig } from './mastra-mermaid-theme'
import styles from './styles.module.css'

function MermaidRenderResult({ renderResult }: { renderResult: RenderResult }): ReactNode {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    renderResult.bindFunctions?.(ref.current!)
  }, [renderResult])

  return (
    <div
      ref={ref}
      className={`${MermaidContainerClassName} ${styles.container}`}
      dangerouslySetInnerHTML={{ __html: renderResult.svg }}
    />
  )
}

function MermaidRenderer({ value }: Props): ReactNode {
  const { colorMode } = useColorMode()
  const config = useMemo(() => mastraMermaidConfig(colorMode), [colorMode])
  const renderResult = useMermaidRenderResult({ text: value, config })

  if (renderResult === null) {
    return null
  }

  return <MermaidRenderResult renderResult={renderResult} />
}

export default function Mermaid(props: Props): ReactNode {
  return (
    <ErrorBoundary fallback={params => <ErrorBoundaryErrorMessageFallback {...params} />}>
      <MermaidRenderer {...props} />
    </ErrorBoundary>
  )
}
