import { useState } from 'react';
import { ContentBlocks } from '@/ds/components/ContentBlocks';
import { cn } from '@/lib/utils';

import { AgentCMSBlock } from './agent-cms-block';
import type { JsonSchema } from '@/lib/rule-engine';
import {
  createInstructionBlock,
  createRefInstructionBlock,
  type InstructionBlock,
} from '../agent-edit-page/utils/form-validation';
import { FileText, PenLine, PlusIcon } from 'lucide-react';
import { Icon } from '@/ds/icons';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { PromptBlockPickerDialog } from './prompt-block-picker-dialog';

export interface AgentCMSBlocksProps {
  items: Array<InstructionBlock>;
  onChange: (items: Array<InstructionBlock>) => void;
  className?: string;
  placeholder?: string;
  schema?: JsonSchema;
}

export const AgentCMSBlocks = ({ items, onChange, className, placeholder, schema }: AgentCMSBlocksProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, idx) => idx !== index);
    onChange(newItems);
  };

  const handleAddInline = () => {
    onChange([...items, createInstructionBlock()]);
  };

  const handleAddRef = (blockId: string) => {
    onChange([...items, createRefInstructionBlock(blockId)]);
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

      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'flex justify-center items-center gap-2 border border-dashed border-border1 text-ui-sm py-2 rounded-md bg-surface1 hover:bg-surface2 active:bg-surface3 text-neutral3 hover:text-neutral6',
            )}
          >
            <Icon>
              <PlusIcon />
            </Icon>
            Add Instruction block
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="center" className="w-[240px]">
          <DropdownMenu.Item onSelect={handleAddInline}>
            <Icon>
              <PenLine />
            </Icon>
            Write inline block
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => setPickerOpen(true)}>
            <Icon>
              <FileText />
            </Icon>
            Reference saved prompt block
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      <PromptBlockPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleAddRef} />
    </div>
  );
};
