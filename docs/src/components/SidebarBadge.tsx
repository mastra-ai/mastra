import React from 'react'
import styles from './SidebarBadge.module.css'

type BadgeType = 'new' | 'advanced' | 'beta' | 'alpha'

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
      default:
        return ''
    }
  }

  return <span className={`${styles.badge} ${styles[`badge--${type}`]}`}>{getLabel(type)}</span>
}

export default SidebarBadge
