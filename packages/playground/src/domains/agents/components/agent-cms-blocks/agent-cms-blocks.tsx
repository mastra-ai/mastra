import { ContentBlocks, DropdownMenu, Icon, cn } from '@mastra/playground-ui';
import type { JsonSchema } from '@mastra/playground-ui';
import { FileText, PenLine, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { InstructionBlock } from '../agent-edit-page/utils/form-validation';
import { createInstructionBlock, createRefInstructionBlock } from '../agent-edit-page/utils/form-validation';
import { AgentCMSBlock } from './agent-cms-block';
import { PromptBlockPickerDialog } from './prompt-block-picker-dialog';

export interface AgentCMSBlocksProps {
  items: Array<InstructionBlock>;
  onChange: (items: Array<InstructionBlock>) => void;
  className?: string;
  placeholder?: string;
  schema?: JsonSchema;
}

interface AddBlockButtonProps {
  onAddInline: () => void;
  onPickRef: () => void;
  className?: string;
}

const AddBlockButton = ({ onAddInline, onPickRef, className }: AddBlockButtonProps) => {
  return (
    <div className={cn('group/add flex items-center gap-2 py-0.5', className)}>
      <div className="flex-1 h-px bg-border1 opacity-0 group-hover/add:opacity-100 transition-opacity duration-150" />
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center justify-center h-6 w-6 rounded-full text-neutral3 hover:text-neutral6 hover:bg-surface4 opacity-0 group-hover/add:opacity-100 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1"
          >
            <Icon>
              <PlusIcon />
            </Icon>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" className="w-[240px]">
          <DropdownMenu.Item onSelect={onAddInline}>
            <Icon>
              <PenLine />
            </Icon>
            Write inline block
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onPickRef}>
            <Icon>
              <FileText />
            </Icon>
            Reference saved prompt block
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      <div className="flex-1 h-px bg-border1 opacity-0 group-hover/add:opacity-100 transition-opacity duration-150" />
    </div>
  );
};

export const AgentCMSBlocks = ({ items, onChange, className, placeholder, schema }: AgentCMSBlocksProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, idx) => idx !== index);
    onChange(newItems);
  };

  const handleAddInlineAt = (index: number) => {
    const newBlock = createInstructionBlock();
    const newItems = [...items];
    newItems.splice(index, 0, newBlock);
    onChange(newItems);
  };

  const handlePickRefAt = (index: number) => {
    setInsertIndex(index);
    setPickerOpen(true);
  };

  const handleAddRef = (blockId: string) => {
    const idx = insertIndex ?? items.length;
    const newBlock = createRefInstructionBlock(blockId);
    const newItems = [...items];
    newItems.splice(idx, 0, newBlock);
    onChange(newItems);
    setInsertIndex(null);
  };

  const handleBlockChange = (index: number, updatedBlock: InstructionBlock) => {
    const newItems = items.map((item, idx) => (idx === index ? updatedBlock : item));
    onChange(newItems);
  };

  // Replace a ref block with an inline block containing the current content
  const handleDereference = (index: number, content: string) => {
    const newBlock = createInstructionBlock(content);
    const newItems = items.map((item, idx) => (idx === index ? newBlock : item));
    onChange(newItems);
  };

  // Called from InlineBlockContent after it creates a prompt block and gets back the promptBlockId
  const handleConvertToRef = (sourceBlockId: string, promptBlockId: string) => {
    const refBlock = createRefInstructionBlock(promptBlockId);
    const newItems = items.map(item => (item.id === sourceBlockId ? refBlock : item));
    onChange(newItems);
  };

  return (
    <div className={cn('flex flex-col w-full h-full overflow-y-auto', className)}>
      {items.length > 0 && (
        <div className="overflow-y-auto h-full pl-10 pr-2">
          <ContentBlocks items={items} onChange={onChange} className="flex flex-col w-full">
            {items.map((block, index) => (
              <div key={block.id}>
                {/* Add-block handle between blocks */}
                {index > 0 && (
                  <AddBlockButton
                    onAddInline={() => handleAddInlineAt(index)}
                    onPickRef={() => handlePickRefAt(index)}
                  />
                )}
                <AgentCMSBlock
                  index={index}
                  block={block}
                  onBlockChange={updatedBlock => handleBlockChange(index, updatedBlock)}
                  onDelete={handleDelete}
                  onDereference={handleDereference}
                  onConvertToRef={handleConvertToRef}
                  placeholder={placeholder}
                  schema={schema}
                />
              </div>
            ))}
          </ContentBlocks>
        </div>
      )}

      {/* Add block at end */}
      <div className="pl-10 pr-2">
        <AddBlockButton
          onAddInline={() => handleAddInlineAt(items.length)}
          onPickRef={() => handlePickRefAt(items.length)}
        />
      </div>

      <PromptBlockPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleAddRef} />
    </div>
  );
};
