/**
 * A component that renders hidden content for llms.txt generation without showing it in the docs UI.
 */

import * as React from 'react'

export function Inject({ children }: { children: React.ReactNode }) {
  return (
    <div data-mid="inject" style={{ display: 'none' }} aria-hidden="true">
      {children}
    </div>
  )
}
