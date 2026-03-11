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
import { ChevronDownIcon, FileText, PenLine, PlusIcon } from 'lucide-react';
import { Icon } from '@/ds/icons';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { PromptBlockPickerDialog } from './prompt-block-picker-dialog';
import { Button } from '@/ds/components/Button';

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
          <Button type="button" className="mx-auto">
            Add Instruction block
            <ChevronDownIcon />
          </Button>
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
