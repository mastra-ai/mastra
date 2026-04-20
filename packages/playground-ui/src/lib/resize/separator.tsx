import { Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export interface PanelSeparatorProps {
  className?: string;
}

export const PanelSeparator = ({ className }: PanelSeparatorProps = {}) => {
  return (
    <Separator
      className={cn(
        'w-1.5 bg-surface3',
        "data-[separator='hover']:bg-surface4!",
        "data-[separator='active']:bg-surface5!",
        'focus:outline-hidden',
        className,
      )}
    />
  );
};
