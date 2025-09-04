import { cn } from '@/lib/utils';

export type SideDialogHeadingProps = {
  children?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
};

export function SideDialogHeading({ children, className, as = 'h1' }: SideDialogHeadingProps) {
  const HeadingTag = as;

  return (
    <HeadingTag
      className={cn(
        'flex items-center text-icon4 text-[1.125rem] font-semibold gap-[1rem]',
        '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em]',
        className,
      )}
    >
      {children}
    </HeadingTag>
  );
}
