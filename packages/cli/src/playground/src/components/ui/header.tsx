import { cn } from '@/lib/utils';

export const Header = ({
  title,
  rightElement,
  children,
  className,
}: {
  title: string | React.ReactNode;
  rightElement?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <header className="sticky top-0 z-50">
      <div
        className={cn(
          'flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <h1 className="font-medium text-sm">{title}</h1>
          {children}
          <div className="ml-auto">{rightElement}</div>
        </div>
      </div>
    </header>
  );
};
