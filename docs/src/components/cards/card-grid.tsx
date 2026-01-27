import { Card, CardHeader, CardContent, CardTitle } from '../ui/card'
import Link from '@docusaurus/Link'

export const CardGrid = ({ children, columns = 2 }: { children: React.ReactNode; columns?: 2 | 3 | 4 }) => {
  const gridCols = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
  }[columns]

  return <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-4 py-4`}>{children}</div>
}

export const CardGridItem = ({
  title,
  description,
  href,
  logo,
  preserveLogoColor = false,
  children,
}: {
  title: string
  description?: string
  href: string
  logo?: string | React.ReactNode
  preserveLogoColor?: boolean
  children?: React.ReactNode
}) => {
  return (
    <Link to={href} className="block h-full w-full text-black! no-underline! dark:text-white!">
      <Card className="h-full w-full cursor-pointer border-(--border) bg-(--mastra-surface-1)/20 shadow-none transition-colors hover:bg-(--mastra-surface-1)/70 dark:border-(--border) dark:hover:bg-(--mastra-surface-2)">
        <CardHeader>
          <div className="flex items-center gap-3">
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
                <div className={preserveLogoColor ? 'h-8 w-8' : 'h-8 w-8 text-black dark:text-white'}>{logo}</div>
              ))}
            <CardTitle className="border-b-0 text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm">{children || description}</CardContent>
      </Card>
    </Link>
  )
}
