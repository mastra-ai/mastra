import { cn } from '@site/src/lib/utils'
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card'
import Link from '@docusaurus/Link'

export const CardGrid = ({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) => {
  const gridCols = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
  }[columns]

  return (
    <div data-slot="card-grid" className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', gridCols, className)}>
      {children}
    </div>
  )
}

export const CardGridItem = ({
  title,
  description,
  href,
  logo,
  preserveLogoColor = false,
  centerLogo = false,
  children,
}: {
  title: string
  description?: string
  href: string
  logo?: string | React.ReactNode
  preserveLogoColor?: boolean
  centerLogo?: boolean
  children?: React.ReactNode
}) => {
  const hasContent = !!(children || description)

  return (
    <Link to={href} className="block h-full w-full no-underline!">
      <Card className="text-card-foreground h-full w-full cursor-pointer rounded-xl border border-(--border) bg-(--mastra-surface-1)/20 px-4 py-4 shadow-none transition-colors hover:bg-(--mastra-surface-1)/70 dark:border-(--border) dark:hover:bg-(--mastra-surface-2)">
        <CardHeader className={cn('flex items-center gap-3', !hasContent ? 'justify-center' : '')}>
          {logo &&
            (typeof logo === 'string' ? (
              <img
                src={logo}
                alt={`${title} logo`}
                className={
                  preserveLogoColor
                    ? 'h-8 w-8 object-contain'
                    : 'h-8 w-8 object-contain dark:brightness-0 dark:contrast-200 dark:invert'
                }
              />
            ) : (
              <div
                className={cn(
                  'h-8 w-8',
                  !preserveLogoColor && 'text-black dark:text-white',
                  centerLogo && 'inline-flex items-center justify-center',
                )}
              >
                {logo}
              </div>
            ))}
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        {hasContent ? <CardContent className="text-sm">{children || description}</CardContent> : null}
      </Card>
    </Link>
  )
}
