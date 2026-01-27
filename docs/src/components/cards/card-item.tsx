'use client'

import Link from '@docusaurus/Link'
import { Card, CardContent } from '../ui/card'
import { useLocation } from '@docusaurus/router'

export function CardItem({ links }: { links: Array<{ title: string; href: string }> }) {
  const location = useLocation()
  const locale = location.pathname.split('/')[1] || 'en'
  return (
    <Card className="w-full rounded-none border-none px-0 shadow-none transition-colors dark:border-[#404040]">
      <CardContent className="grid w-full gap-3 px-0 md:grid-cols-2 lg:grid-cols-3">
        {links.map(item => (
          <Link
            key={`${item.title}-${item.href}`}
            to={`/${locale}${item.href}`}
            style={{
              textDecoration: 'none',
            }}
            className="group mb-0 flex flex-1 items-center justify-center rounded-md border-[0.5px] border-[var(--light-border-muted)] bg-[var(--light-color-surface-3)] p-2 px-4 text-center text-sm dark:border-[#343434] dark:bg-[#1a1a1a]/50"
          >
            {item.title}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
