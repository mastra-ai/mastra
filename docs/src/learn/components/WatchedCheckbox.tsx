import { cn } from '@site/src/lib/utils'

type WatchedCheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function WatchedCheckbox({ checked, onChange, className }: WatchedCheckboxProps) {
  return (
    <label className={cn('flex items-center gap-3 py-3', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-400 text-green-500 accent-green-500"
      />
      <span className="text-sm text-(--mastra-text-secondary)">Mark as watched</span>
    </label>
  )
}
