import React from 'react'
import styles from './SidebarBadge.module.css'

type BadgeType = 'new' | 'advanced' | 'beta' | 'alpha' | 'deprecated'

interface SidebarBadgeProps {
  type: BadgeType
}

export function SidebarBadge({ type }: SidebarBadgeProps) {
  const getLabel = (type: BadgeType) => {
    switch (type) {
      case 'new':
        return 'New'
      case 'advanced':
        return 'Advanced'
      case 'beta':
        return 'Beta'
      case 'alpha':
        return 'Alpha'
      case 'deprecated':
        return 'Deprecated'
      default:
        return ''
    }
  }

  return (
    <span className={`${styles.badge} ${styles[`badge--${type}`]}`}>
      <span className="sr-only">(</span>
      {getLabel(type)}
      <span className="sr-only">)</span>
    </span>
  )
}

export default SidebarBadge
