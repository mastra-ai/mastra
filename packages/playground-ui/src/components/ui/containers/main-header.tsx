import { cn } from '@/lib/utils';

export function MainHeader({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <header
      className={cn(
        'flex w-full items-center border-b border-border1 h-[2.5rem] px-[1.25rem] py-[0.375rem] gap-[1.125rem]',
        {},
      )}
      style={style}
    >
      {children}
    </header>
  );
}
type MainHeaderTitleProps = {
  children: React.ReactNode;
};

export const MainHeaderTitle = ({ children }: MainHeaderTitleProps) => {
  return <h1 className="font-medium text-white text-ui-lg leading-ui-lg">{children}</h1>;
};
