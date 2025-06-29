import { cn } from '@/lib/utils';

type PanelHeaderProps = {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function PanelHeader({ children, title, icon, className, style }: PanelHeaderProps) {
  return (
    <div className={cn('flex gap-[0.625rem] text-[1rem] items-center mb-[1.25rem]', className)} style={style}>
      <div className="w-[2rem] h-[2rem] rounded-md [&>svg]:w-[1.25rem] [&>svg]:h-[1.25rem] bg-surface4 flex items-center justify-center">
        {icon && icon}
      </div>
      {title}
      {children}
    </div>
  );
}
