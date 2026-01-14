import type { ReactNode, DragEvent } from 'react';
import type { BuilderNodeType } from '../types';
import { cn } from '@/lib/utils';

export interface StepItemProps {
  type: BuilderNodeType;
  label: string;
  icon: ReactNode;
  color: string;
  description?: string;
}

export function StepItem({ type, label, icon, color, description }: StepItemProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/workflow-node-type', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg cursor-grab',
        'bg-surface3 border border-border1',
        'hover:border-border2 hover:bg-surface4',
        'active:cursor-grabbing',
        'transition-colors duration-150',
      )}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-icon6 truncate">{label}</div>
        {description && <div className="text-xs text-icon3 truncate">{description}</div>}
      </div>
    </div>
  );
}
