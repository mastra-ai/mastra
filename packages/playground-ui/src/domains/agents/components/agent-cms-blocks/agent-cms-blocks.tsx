'use client';

import { Plus } from 'lucide-react';

import { ContentBlocks } from '@/ds/components/ContentBlocks';
import { cn } from '@/lib/utils';

import { AgentCMSBlock } from './agent-cms-block';

export interface AgentCMSBlocksProps {
  items: Array<string>;
  onChange: (items: Array<string>) => void;
  className?: string;
  placeholder?: string;
}

export const AgentCMSBlocks = ({ items, onChange, className, placeholder }: AgentCMSBlocksProps) => {
  const handleDelete = (index: number) => {
    const newItems = items.filter((_, idx) => idx !== index);
    onChange(newItems);
  };

  const handleAdd = () => {
    onChange([...items, '']);
  };

  return (
    <div className={cn('flex flex-col gap-4 w-full', className)}>
      <ContentBlocks items={items} onChange={onChange} className="flex flex-col gap-2 w-full">
        {items.map((_, index) => (
          <AgentCMSBlock key={index} index={index} onDelete={handleDelete} placeholder={placeholder} />
        ))}
      </ContentBlocks>

      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          'border border-border1 text-neutral6 text-ui-sm py-2 rounded-md bg-surface1 hover:bg-surface2 active:bg-surface3',
        )}
      >
        Add content block
      </button>
    </div>
  );
};
