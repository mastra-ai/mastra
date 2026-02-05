import { GripVertical, Trash2 } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { ContentBlock } from '@/ds/components/ContentBlocks';
import type { JsonSchema, Rule } from '@/lib/rule-engine';
import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons';
import { AgentCMSBlockRules } from './agent-cms-block-rules';
import { CodeEditor } from '@/ds/components/CodeEditor';
import type { InstructionBlock } from '../agent-edit-page/utils/form-validation';

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
    <div>
      <div className="border border-border1 rounded-md w-full bg-surface2">
        <div className="flex items-center justify-between p-2 border-b border-border1">
          <div {...dragHandleProps} className="text-neutral3 hover:text-neutral6">
            <Icon>
              <GripVertical />
            </Icon>
          </div>

          {onDelete && (
            <IconButton variant="ghost" size="sm" onClick={onDelete} tooltip="Delete block">
              <Trash2 />
            </IconButton>
          )}
        </div>

        <CodeEditor
          value={block.content}
          onChange={handleContentChange}
          placeholder={placeholder}
          className="border-none rounded-none text-neutral6 min-h-[200px]"
          language="markdown"
          highlightVariables
          schema={schema}
        />

        <AgentCMSBlockRules schema={schema} rules={block.rules} onChange={handleRulesChange} />
      </div>
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
    <ContentBlock index={index} draggableId={block.id} className={className}>
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
