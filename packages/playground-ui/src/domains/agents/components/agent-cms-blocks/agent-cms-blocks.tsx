import { ContentBlocks } from '@/ds/components/ContentBlocks';
import { cn } from '@/lib/utils';

import { AgentCMSBlock } from './agent-cms-block';
import type { JsonSchema } from '@/lib/rule-engine';
import { createInstructionBlock, type InstructionBlock } from '../agent-edit-page/utils/form-validation';
import { PlusIcon } from 'lucide-react';
import { Icon } from '@/ds/icons';

export interface AgentCMSBlocksProps {
  items: Array<InstructionBlock>;
  onChange: (items: Array<InstructionBlock>) => void;
  className?: string;
  placeholder?: string;
  schema?: JsonSchema;
}

export const AgentCMSBlocks = ({ items, onChange, className, placeholder, schema }: AgentCMSBlocksProps) => {
  const handleDelete = (index: number) => {
    const newItems = items.filter((_, idx) => idx !== index);
    onChange(newItems);
  };

  const handleAdd = () => {
    onChange([...items, createInstructionBlock()]);
  };

  const handleBlockChange = (index: number, updatedBlock: InstructionBlock) => {
    const newItems = items.map((item, idx) => (idx === index ? updatedBlock : item));
    onChange(newItems);
  };

  return (
    <div className={cn('flex flex-col gap-4 w-full h-full overflow-y-auto', className)}>
      {items.length > 0 && (
        <div className="overflow-y-auto h-full">
          <ContentBlocks items={items} onChange={onChange} className="flex flex-col gap-4 w-full">
            {items.map((block, index) => (
              <AgentCMSBlock
                key={block.id}
                index={index}
                block={block}
                onBlockChange={updatedBlock => handleBlockChange(index, updatedBlock)}
                onDelete={handleDelete}
                placeholder={placeholder}
                schema={schema}
              />
            ))}
          </ContentBlocks>
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          'flex justify-center items-center gap-2 border border-dashed border-border1 text-neutral6 text-ui-sm py-2 rounded-md bg-surface1 hover:bg-surface2 active:bg-surface3 text-neutral3 hover:text-neutral6 active:text-neutral6',
        )}
      >
        <Icon>
          <PlusIcon />
        </Icon>
        Add Instruction block
      </button>
    </div>
  );
};
