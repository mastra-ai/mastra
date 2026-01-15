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
        'flex items-start text-neutral4 text-header-sm font-semibold gap-[.5rem]',
        '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0 [&>svg]:mt-[.2em] [&>svg]:opacity-70',
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
