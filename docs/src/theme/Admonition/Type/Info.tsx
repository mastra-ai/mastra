import React from 'react'
import AdmonitionLayout from '@theme/Admonition/Layout'

const defaultProps = {
  icon: true,
  title: 'note',
}

// `info` is an alias for `note`: authors reach for either keyword, and both
// render identically.
export default function AdmonitionTypeInfo(props: React.ComponentProps<typeof AdmonitionLayout>) {
  return (
    <AdmonitionLayout {...defaultProps} {...props} type="note">
      {props.children}
    </AdmonitionLayout>
  )
}
