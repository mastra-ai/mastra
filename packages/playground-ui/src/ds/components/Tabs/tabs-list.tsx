import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const tabListVariants = cva('flex items-center relative text-ui-lg', {
  variants: {
    variant: {
      line: 'w-max min-w-full border-b border-border1',
      pill: 'w-fit gap-1 rounded-full bg-surface2 p-1',
      'pill-ghost': 'w-fit gap-1 rounded-full p-1',
    },
  },
  defaultVariants: {
    variant: 'line',
  },
});

export type TabListProps = {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
} & VariantProps<typeof tabListVariants>;

export const TabList = ({ children, className, variant, sticky }: TabListProps) => {
  const resolvedVariant = variant ?? 'line';

  return (
    <div className={cn('w-full overflow-x-auto', sticky && 'sticky top-0 z-10 bg-surface2')}>
      <BaseTabs.List
        data-variant={resolvedVariant}
        className={cn('group/tabs-list', tabListVariants({ variant: resolvedVariant }), className)}
      >
        {children}
        {resolvedVariant === 'line' && (
          <BaseTabs.Indicator
            className={cn(
              'absolute bottom-0 left-0 bg-neutral3',
              'w-[var(--active-tab-width)] h-0.5',
              'transition-all duration-200 ease-in-out',
            )}
            style={{ transform: 'translateX(var(--active-tab-left))' }}
          />
        )}
        {(resolvedVariant === 'pill' || resolvedVariant === 'pill-ghost') && (
          <BaseTabs.Indicator
            className={cn(
              'absolute top-1/2 left-0 z-0 rounded-full bg-surface4',
              'w-[var(--active-tab-width)] h-[calc(100%-0.5rem)]',
              'transition-all duration-200 ease-in-out',
            )}
            style={{ transform: 'translateY(-50%) translateX(var(--active-tab-left))' }}
          />
        )}
      </BaseTabs.List>
    </div>
  );
};
