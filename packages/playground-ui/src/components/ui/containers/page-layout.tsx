import { cn } from '@/lib/utils';

export function PageLayout({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        `h-[calc(100vh-1rem)] bg-[#0A0A0A] border-[1px] border-[#1A1A1A] font-sans grid grid-cols-[auto_1fr] grid-rows-[auto_1fr] m-[0.5rem] rounded-[0.625rem]`,
        className,
      )}
      style={{
        ...style,
      }}
    >
      {children}
    </div>
  );
}
