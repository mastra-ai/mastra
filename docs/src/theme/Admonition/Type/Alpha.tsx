import React from 'react'
import AdmonitionLayout from '@theme/Admonition/Layout'

const defaultProps = {
  icon: true,
  title: 'alpha',
}

export default function AdmonitionTypeAlpha(props: React.ComponentProps<typeof AdmonitionLayout>) {
  return (
    <AdmonitionLayout {...defaultProps} {...props}>
      {props.children}
    </AdmonitionLayout>
  )
}
