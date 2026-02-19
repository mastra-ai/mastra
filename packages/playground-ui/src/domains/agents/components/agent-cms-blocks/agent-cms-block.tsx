import { useEffect, useRef } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { GripVertical, X } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { ContentBlock } from '@/ds/components/ContentBlocks';
import type { JsonSchema, RuleGroup } from '@/lib/rule-engine';
import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { cn } from '@/lib/utils';
import type { InstructionBlock } from '../agent-edit-page/utils/form-validation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { DisplayConditionsDialog } from '@/domains/cms';

export interface AgentCMSBlockProps {
  index: number;
  block: InstructionBlock;
  onBlockChange: (block: InstructionBlock) => void;
  onDelete?: (index: number) => void;
  placeholder?: string;
  className?: string;
  schema?: JsonSchema;
  autoFocus?: boolean;
}

interface AgentCMSBlockContentProps {
  index: number;
  block: InstructionBlock;
  onBlockChange: (block: InstructionBlock) => void;
  placeholder?: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
  schema?: JsonSchema;
  autoFocus?: boolean;
}

const AgentCMSBlockContent = ({
  index,
  block,
  onBlockChange,
  placeholder,
  dragHandleProps,
  onDelete,
  schema,
  autoFocus = false,
}: AgentCMSBlockContentProps) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    if (autoFocus) {
      editorRef.current?.editor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [autoFocus]);

  const handleContentChange = (content: string) => {
    onBlockChange({ ...block, content });
  };

  const handleRulesChange = (ruleGroup: RuleGroup | undefined) => {
    onBlockChange({ ...block, rules: ruleGroup });
  };

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      {/* Top bar with drag handle and delete button */}
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

          <Txt variant="ui-sm" className="text-neutral3 font-mono">
            {index + 1}
          </Txt>
        </div>

        <div className="flex items-center gap-1">
          <DisplayConditionsDialog
            entityName={`Block ${index + 1}`}
            schema={schema}
            rules={block.rules}
            onRulesChange={handleRulesChange}
          />

          {onDelete && (
            <IconButton variant="ghost" size="sm" onClick={onDelete} tooltip="Delete block">
              <X />
            </IconButton>
          )}
        </div>
      </div>

      {/* CodeEditor */}
      <CodeEditor
        ref={editorRef}
        value={block.content}
        onChange={handleContentChange}
        placeholder={placeholder}
        className="border-none rounded-none text-neutral6 h-full bg-surface2 min-h-[300px]"
        language="markdown"
        highlightVariables
        showCopyButton={false}
        schema={schema}
        autoFocus={autoFocus}
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
  autoFocus,
}: AgentCMSBlockProps) => {
  return (
    <ContentBlock
      index={index}
      draggableId={block.id}
      className={cn('h-full rounded-md border border-border1 overflow-hidden', className)}
    >
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <AgentCMSBlockContent
          index={index}
          block={block}
          onBlockChange={onBlockChange}
          placeholder={placeholder}
          dragHandleProps={dragHandleProps}
          onDelete={onDelete ? () => onDelete(index) : undefined}
          schema={schema}
          autoFocus={autoFocus}
        />
      )}
    </ContentBlock>
  );
};
