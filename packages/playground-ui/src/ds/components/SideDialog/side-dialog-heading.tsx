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
        'flex items-start gap-2',
        as === 'h1' ? 'text-heading text-foreground' : 'text-subheading text-foreground',
        '[&>svg]:mt-0.5 [&>svg]:size-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-70',
        className,
      )}
    >
      {children}
    </HeadingTag>
  );
}
