import { cn } from '@/lib/utils';

export type FieldBlockLayoutProps = {
  children: React.ReactNode;
  className?: string;
  layout?: 'vertical' | 'horizontal';
  // Optional prop to specify label column width in horizontal layout
  labelColumnWidth?: string; // e.g., '150px' or '30%'
};

export function FieldBlockLayout({
  children,
  className,
  layout = 'vertical',
  labelColumnWidth,
}: FieldBlockLayoutProps) {
  return (
    <div
      className={cn(
        'grid gap-2 text-neutral4',
        {
          'horizontal-field-block grid-cols-[auto_1fr] items-baseline': layout === 'horizontal',
        },
        className,
      )}
      style={
        layout === 'horizontal' && labelColumnWidth ? { gridTemplateColumns: `${labelColumnWidth} 1fr` } : undefined
      }
    >
      {children}
    </div>
  );
}
