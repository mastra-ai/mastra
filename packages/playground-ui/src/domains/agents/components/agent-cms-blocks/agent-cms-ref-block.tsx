import { GripVertical, X, FileText, ExternalLink } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

import { ContentBlock } from '@/ds/components/ContentBlocks';
import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { Badge } from '@/ds/components/Badge';
import { useLinkComponent } from '@/lib/framework';
import { useStoredPromptBlock } from '@/domains/prompt-blocks';
import type { RefInstructionBlock } from '../agent-edit-page/utils/form-validation';

export interface AgentCMSRefBlockProps {
  index: number;
  block: RefInstructionBlock;
  onDelete?: (index: number) => void;
  className?: string;
}

interface RefBlockContentProps {
  index: number;
  block: RefInstructionBlock;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
}

const RefBlockContent = ({ index, block, dragHandleProps, onDelete }: RefBlockContentProps) => {
  const { data: promptBlock, isLoading } = useStoredPromptBlock(block.promptBlockId);
  const { navigate, paths } = useLinkComponent();

  return (
    <div className="h-full flex flex-col">
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

          <Badge variant="info">Reference</Badge>
        </div>

        <div className="flex items-center gap-1">
          {promptBlock && (
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => navigate(paths.cmsPromptBlockEditLink(block.promptBlockId))}
              tooltip="Edit prompt block"
            >
              <ExternalLink />
            </IconButton>
          )}

          {onDelete && (
            <IconButton variant="ghost" size="sm" onClick={onDelete} tooltip="Remove reference">
              <X />
            </IconButton>
          )}
        </div>
      </div>

      {/* Block content preview */}
      <div className="flex-1 bg-surface2 px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-neutral3">
            <Txt variant="ui-sm">Loading prompt block...</Txt>
          </div>
        ) : promptBlock ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-neutral3 shrink-0" />
              <Txt variant="ui-sm" className="text-neutral6 font-medium">
                {promptBlock.name}
              </Txt>
            </div>
            {promptBlock.description && (
              <Txt variant="ui-xs" className="text-neutral3 line-clamp-2 pl-6">
                {promptBlock.description}
              </Txt>
            )}
            {promptBlock.content && (
              <div className="mt-1 rounded border border-border1 bg-surface1 px-3 py-2 max-h-[120px] overflow-y-auto">
                <Txt variant="ui-xs" className="text-neutral4 whitespace-pre-wrap font-mono line-clamp-5">
                  {promptBlock.content}
                </Txt>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-warning">
            <FileText className="h-4 w-4 shrink-0" />
            <Txt variant="ui-sm">Prompt block not found (ID: {block.promptBlockId})</Txt>
          </div>
        )}
      </div>
    </div>
  );
};

export const AgentCMSRefBlock = ({ index, block, onDelete, className }: AgentCMSRefBlockProps) => {
  return (
    <ContentBlock
      index={index}
      draggableId={block.id}
      className={cn('h-full rounded-md border border-border1 overflow-hidden', className)}
    >
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <RefBlockContent
          index={index}
          block={block}
          dragHandleProps={dragHandleProps}
          onDelete={onDelete ? () => onDelete(index) : undefined}
        />
      )}
    </ContentBlock>
  );
};
