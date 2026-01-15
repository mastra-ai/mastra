import type { ReactNode, DragEvent, KeyboardEvent } from 'react';
import type { BuilderNodeType } from '../types';
import { cn } from '@/lib/utils';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';

export interface StepItemProps {
  type: BuilderNodeType;
  label: string;
  icon: ReactNode;
  color: string;
  description?: string;
}

export function StepItem({ type, label, icon, color, description }: StepItemProps) {
  const addNode = useWorkflowBuilderStore(state => state.addNode);

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/workflow-node-type', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Handle keyboard selection - add node to center of canvas
  const handleSelect = () => {
    // Add node at a default position (center of typical canvas area)
    addNode(type, { x: 400, y: 300 });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      aria-label={`Add ${label} step${description ? `. ${description}` : ''}`}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg cursor-grab',
        'bg-surface3 border border-border1',
        'hover:border-border2 hover:bg-surface4',
        'focus:outline-none focus:ring-2 focus:ring-accent1/50 focus:border-accent1',
        'active:cursor-grabbing',
        'transition-colors duration-150',
      )}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
        aria-hidden="true"
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
