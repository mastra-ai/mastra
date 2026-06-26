import React from 'react'
import AdmonitionLayout from '@theme/Admonition/Layout'

const defaultProps = {
  icon: true,
  title: 'beta',
}

export default function AdmonitionTypeExperimental(props: React.ComponentProps<typeof AdmonitionLayout>) {
  return (
    <AdmonitionLayout {...defaultProps} {...props}>
      {props.children}
    </AdmonitionLayout>
  )
}
