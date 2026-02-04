import { GripVertical, Trash2 } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { ContentBlock, useContentBlock } from '@/ds/components/ContentBlocks';
import type { JsonSchema, Rule } from '@/lib/rule-engine';
import { IconButton } from '@/ds/components/IconButton';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/ds/icons';
import { AgentCMSBlockRules } from './agent-cms-block-rules';
import { useState } from 'react';
import { CodeEditor } from '@/ds/components/CodeEditor';

export interface AgentCMSBlockProps {
  index: number;
  onDelete?: (index: number) => void;
  placeholder?: string;
  className?: string;
  schema?: JsonSchema;
}

interface AgentCMSBlockContentProps {
  placeholder?: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
  schema?: JsonSchema;
}

const AgentCMSBlockContent = ({ placeholder, dragHandleProps, onDelete, schema }: AgentCMSBlockContentProps) => {
  const [item, setItem] = useContentBlock();
  const [rules, setRules] = useState<Rule[]>([]);

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
          value={item}
          onChange={setItem}
          placeholder={placeholder}
          className="border-none rounded-none text-neutral6 min-h-[200px]"
          language="markdown"
          highlightVariables
        />
        <AgentCMSBlockRules schema={schema} rules={rules} onChange={setRules} />
      </div>
    </div>
  );
};

export const AgentCMSBlock = ({ index, onDelete, placeholder, className, schema }: AgentCMSBlockProps) => {
  return (
    <ContentBlock index={index} className={className}>
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <AgentCMSBlockContent
          placeholder={placeholder}
          dragHandleProps={dragHandleProps}
          onDelete={onDelete ? () => onDelete(index) : undefined}
          schema={schema}
        />
      )}
    </ContentBlock>
  );
};
