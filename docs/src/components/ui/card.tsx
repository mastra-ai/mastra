import * as React from 'react'
import { cn } from '@site/src/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('bg-card text-card-foreground flex flex-col gap-4 rounded-xl border py-6 shadow-sm', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('leading-none', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('font-normal text-muted-foreground [&>p]:mb-0!', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardContent }
