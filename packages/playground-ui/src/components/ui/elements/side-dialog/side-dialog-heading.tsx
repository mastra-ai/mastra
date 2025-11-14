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
        'flex items-start text-icon4 text-[1.125rem] font-semibold gap-[.5rem]',
        '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0 [&>svg]:mt-[.2em] [&>svg]:opacity-70',
        {
          'text-[1.125rem]': as === 'h1',
          'text-[1rem]': as === 'h2',
        },
        className,
      )}
    >
      {children}
    </HeadingTag>
  );
}
