import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, icon, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'grid gap-[.5rem] pt-[2rem] pb-[2rem]',
        '[&>h1]:text-icon6 [&>h1]:text-[1.25rem] [&>h1]:font-normal [&>h1]:flex [&>h1]:items-center [&>h1]:gap-[0.5rem]',
        '[&_svg]:w-[1.4rem] [&_svg]:h-[1.4rem] [&_svg]:text-icon3',
        '[&>p]:text-icon4 [&>p]:text-[0.875rem] [&>p]:m-0',
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
