import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title?: string | 'loading';
  description?: string | 'loading';
  icon?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, icon, className }: PageHeaderProps) {
  const titleIsLoading = title === 'loading';
  const descriptionIsLoading = description === 'loading';

  return (
    <header className={cn('grid gap-[.5rem] pt-[2rem] pb-[2rem]', className)}>
      <h1
        className={cn(
          'text-icon6 text-[1.25rem] font-normal flex items-center gap-[0.5rem]',
          '[&>svg]:w-[1.4rem] [&>svg]:h-[1.4rem] [&>svg]:text-icon3',
          {
            'bg-surface4 w-[15rem] max-w-[50%] rounded-md animate-pulse': titleIsLoading,
          },
        )}
      >
        {titleIsLoading ? (
          <>&nbsp;</>
        ) : (
          <>
            {icon && icon} {title}
          </>
        )}
      </h1>
      {description && (
        <p
          className={cn('text-icon4 text-[0.875rem] m-0', {
            'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': descriptionIsLoading,
          })}
        >
          {descriptionIsLoading ? <>&nbsp;</> : description}
        </p>
      )}
    </header>
  );
}
