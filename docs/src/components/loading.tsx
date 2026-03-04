import { cn } from '@site/src/lib/utils'

export const PulsingDots = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex items-center justify-center space-x-1', className)}>
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: '0ms' }}></div>
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: '150ms' }}></div>
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}
