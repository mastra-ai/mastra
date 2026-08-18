import React, { type ReactNode } from 'react'
import clsx from 'clsx'
import Link from '@docusaurus/Link'

export function BreadcrumbsItemLink({
  children,
  href,
  isLast,
  onClick,
  className,
}: {
  children: ReactNode
  href: string | undefined
  isLast: boolean
  onClick?: () => void
  className?: string
}): ReactNode {
  const linkClassName = clsx('breadcrumbs__link', className)
  if (isLast) {
    return <span className={linkClassName}>{children}</span>
  }
  if (href) {
    return (
      <Link className={linkClassName} href={href}>
        <span>{children}</span>
      </Link>
    )
  }
  return onClick ? (
    <button className={linkClassName} type="button" onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={linkClassName}>{children}</span>
  )
}

export function BreadcrumbsItem({ children, active }: { children: ReactNode; active?: boolean }): ReactNode {
  return (
    <li
      className={clsx('breadcrumbs__item', {
        'breadcrumbs__item--active': active,
      })}
    >
      {children}
    </li>
  )
}
