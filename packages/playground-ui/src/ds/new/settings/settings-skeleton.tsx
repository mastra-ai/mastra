import { SettingsItem } from './settings-list';
import { SettingsRow } from './settings-row';
import { Skeleton } from '@/ds/components/Skeleton/skeleton';
import { SkeletonText } from '@/ds/components/Skeleton/skeleton-text';
import { cn } from '@/lib/utils';

const bar = 'motion-reduce:before:animate-none';

export type SettingsSkeletonProps = {
  /** Announced while loading, e.g. "Loading members". */
  label: string;
  /** Placeholder rows, matching how many the loaded list usually has. */
  rows?: number;
  /** `row` stands in for `SettingsRow`s (label left, control right); `item` for `SettingsItem`s (icon, title, description). */
  variant?: 'row' | 'item';
  className?: string;
};

/**
 * The loading state for anything inside a `SettingsContainer`. Placeholders are built from the real `SettingsRow` and
 * `SettingsItem`, so they sit exactly where the loaded rows will.
 *
 * ```tsx
 * <SettingsContainer>
 *   {isLoading ? <SettingsSkeleton label="Loading members" variant="item" rows={3} /> : members.map(...)}
 * </SettingsContainer>
 * ```
 */
export function SettingsSkeleton({ label, rows = 2, variant = 'row', className }: SettingsSkeletonProps) {
  const Placeholder = variant === 'item' ? ItemPlaceholder : RowPlaceholder;

  return (
    // One child of the card, so it takes the card's row padding; inside, rows repeat that rhythm with hairlines.
    <div
      role="status"
      aria-label={label}
      data-slot="settings-skeleton"
      className={cn('grid divide-y divide-border *:py-3.25 *:first:pt-0 *:last:pb-0', className)}
    >
      {Array.from({ length: rows }, (_, index) => (
        <Placeholder key={index} />
      ))}
    </div>
  );
}

function ItemPlaceholder() {
  return (
    <SettingsItem
      aria-hidden
      media={<Skeleton className={cn('size-avatar-md shrink-0 rounded-lg', bar)} />}
      title={<SkeletonText line="text-label" className={cn('w-32', bar)} />}
      description={<SkeletonText line="text-caption" className={cn('w-48 max-w-full', bar)} />}
    />
  );
}

function RowPlaceholder() {
  return (
    <SettingsRow
      aria-hidden
      label={<SkeletonText line="text-label" className={cn('w-28', bar)} />}
      description={<SkeletonText line="text-caption" className={cn('w-48 max-w-full', bar)} />}
    >
      <Skeleton className={cn('h-control-sm w-28 max-w-full rounded-full', bar)} />
    </SettingsRow>
  );
}
