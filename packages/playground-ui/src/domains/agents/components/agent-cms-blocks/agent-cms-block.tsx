import { GripVertical, Ruler, Trash2 } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { ContentBlock } from '@/ds/components/ContentBlocks';
import type { JsonSchema, Rule } from '@/lib/rule-engine';
import { RuleBuilder } from '@/lib/rule-engine';
import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { cn } from '@/lib/utils';
import type { InstructionBlock } from '../agent-edit-page/utils/form-validation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export interface AgentCMSBlockProps {
  index: number;
  block: InstructionBlock;
  onBlockChange: (block: InstructionBlock) => void;
  onDelete?: (index: number) => void;
  placeholder?: string;
  className?: string;
  schema?: JsonSchema;
}

interface AgentCMSBlockContentProps {
  block: InstructionBlock;
  onBlockChange: (block: InstructionBlock) => void;
  placeholder?: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
  schema?: JsonSchema;
}

const AgentCMSBlockContent = ({
  block,
  onBlockChange,
  placeholder,
  dragHandleProps,
  onDelete,
  schema,
}: AgentCMSBlockContentProps) => {
  const handleContentChange = (content: string) => {
    onBlockChange({ ...block, content });
  };

  const handleRulesChange = (rules: Rule[]) => {
    onBlockChange({ ...block, rules });
  };

  return (
    <div className="h-full min-h-[300px] ">
      {/* Drag handle - always visible, top-left */}

      <div className="bg-surface2 px-2 py-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div {...dragHandleProps} className="text-neutral3 hover:text-neutral6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon>
                  <GripVertical />
                </Icon>
              </TooltipTrigger>
              <TooltipContent>Drag to reorder</TooltipContent>
            </Tooltip>
          </div>

          {/* Action bar - hover-visible, top-right */}

          {schema && (
            <Popover>
              <PopoverTrigger asChild>
                <IconButton variant="ghost" size="sm" tooltip="Display conditions">
                  <Ruler />
                </IconButton>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <RuleBuilder schema={schema} rules={block.rules} onChange={handleRulesChange} />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {onDelete && (
          <IconButton variant="ghost" size="sm" onClick={onDelete} tooltip="Delete block">
            <Trash2 />
          </IconButton>
        )}
      </div>

      {/* CodeEditor - add top padding for action bar space */}
      <CodeEditor
        value={block.content}
        onChange={handleContentChange}
        placeholder={placeholder}
        className="border-none rounded-none text-neutral6 h-full bg-surface2"
        language="markdown"
        highlightVariables
        showCopyButton={false}
        schema={schema}
      />
    </div>
  );
};

export const AgentCMSBlock = ({
  index,
  block,
  onBlockChange,
  onDelete,
  placeholder,
  className,
  schema,
}: AgentCMSBlockProps) => {
  return (
    <ContentBlock
      index={index}
      draggableId={block.id}
      className={cn(index > 0 && 'border-t border-dashed border-border1', 'h-full', className)}
    >
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <AgentCMSBlockContent
          block={block}
          onBlockChange={onBlockChange}
          placeholder={placeholder}
          dragHandleProps={dragHandleProps}
          onDelete={onDelete ? () => onDelete(index) : undefined}
          schema={schema}
        />
      )}
    </ContentBlock>
  );
};
