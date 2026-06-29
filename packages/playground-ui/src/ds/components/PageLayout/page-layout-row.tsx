import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const pageLayoutRowVariants = cva('flex justify-between gap-3', {
  variants: {
    align: {
      start: 'items-start',
      center: 'items-center',
    },
    stack: {
      horizontal: 'flex-row',
      responsive: 'flex-col items-stretch sm:flex-row',
    },
  },
  compoundVariants: [
    {
      stack: 'responsive',
      align: 'start',
      class: 'sm:items-start',
    },
    {
      stack: 'responsive',
      align: 'center',
      class: 'sm:items-center',
    },
  ],
  defaultVariants: {
    align: 'start',
    stack: 'horizontal',
  },
});

export type PageLayoutRowProps = {
  children?: React.ReactNode;
  className?: string;
} & VariantProps<typeof pageLayoutRowVariants>;

export function PageLayoutRow({ children, className, align, stack }: PageLayoutRowProps) {
  return <div className={cn(pageLayoutRowVariants({ align, stack }), className)}>{children}</div>;
}
