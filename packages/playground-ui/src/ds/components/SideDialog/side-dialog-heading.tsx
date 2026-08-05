import { cn } from '@/lib/utils';

export type SideDialogHeadingProps = {
  children?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2';
};

export function SideDialogHeading({ children, className, as = 'h1' }: SideDialogHeadingProps) {
  const HeadingTag = as;

  return (
    <HeadingTag
      className={cn(
        'flex items-start gap-2 text-header-sm font-semibold text-neutral4',
        '[&>svg]:mt-0.5 [&>svg]:size-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-70',
        {
          'text-header-sm': as === 'h1',
          'text-ui-lg': as === 'h2',
        },
        className,
      )}
    >
      {children}
    </HeadingTag>
  );
}
