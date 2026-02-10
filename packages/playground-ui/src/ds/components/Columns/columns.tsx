import { cn } from '@/index';

export type ColumnsProps = {
  children: React.ReactNode;
  className?: string;
};

export function Columns({ children, className }: ColumnsProps) {
  return (
    <div
      className={cn(`grid w-full h-full grid-cols-1`, className)}
      // style={{ border: '2px solid white' }}
    >
      {children}
    </div>
  );
}
