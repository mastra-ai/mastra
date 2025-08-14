import { cn } from '@/lib/utils';

type EntityMainHeaderProps = {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  placement?: 'page' | 'sidebar';
};

export function EntityMainHeader({
  title,
  description,
  icon,
  children,
  isLoading,
  className,
  placement = 'page',
}: EntityMainHeaderProps) {
  return (
    <header
      className={cn(
        'grid gap-[.5rem]',
        '[&>h1]:text-icon6 [&>h1]:text-[1.25rem] [&>h1]:font-normal [&>h1]:flex [&>h1]:items-center [&>h1]:gap-[0.5rem]',
        '[&_svg]:w-[1.4rem] [&_svg]:h-[1.4rem] [&_svg]:text-icon3',
        '[&>p]:text-icon4 [&>p]:text-[0.875rem] [&>p]:m-0',
        { 'pt-[2rem] pb-[2rem]': placement === 'page' },
        { 'pt-[1.5em] pb-[1rem]': placement === 'sidebar' },
        className,
      )}
    >
      <h1>
        {icon && icon} {title}
      </h1>
      {description && <p>{description}</p>}
    </header>
  );
}
