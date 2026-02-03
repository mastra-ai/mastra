'use client';

import { GripVertical, Trash2 } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { ContentBlock, useContentBlock } from '@/ds/components/ContentBlocks';
import { cn } from '@/lib/utils';
import { IconButton } from '@/ds/components/IconButton';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/ds/icons';

export interface AgentCMSBlockProps {
  index: number;
  onDelete?: (index: number) => void;
  placeholder?: string;
  className?: string;
}

interface AgentCMSBlockContentProps {
  placeholder?: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
}

const AgentCMSBlockContent = ({ placeholder, dragHandleProps, onDelete }: AgentCMSBlockContentProps) => {
  const [item, setItem] = useContentBlock();

  return (
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

      <Textarea
        value={item}
        onChange={e => setItem(e.target.value)}
        placeholder={placeholder}
        className="border-none rounded-none text-neutral6"
      />
    </div>
  );
};

export const AgentCMSBlock = ({ index, onDelete, placeholder, className }: AgentCMSBlockProps) => {
  return (
    <ContentBlock index={index} className={className}>
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <AgentCMSBlockContent
          placeholder={placeholder}
          dragHandleProps={dragHandleProps}
          onDelete={onDelete ? () => onDelete(index) : undefined}
        />
      )}
    </ContentBlock>
  );
};
