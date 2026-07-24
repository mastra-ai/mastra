import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { ContentBlock } from '@mastra/playground-ui/components/ContentBlocks';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import { GripVertical, X, ExternalLink, ChevronDown, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import type { RefInstructionBlock } from '../agent-edit-page/utils/form-validation';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useStoredPromptBlock, useStoredPromptBlockMutations } from '@/domains/prompt-blocks';
import { useLinkComponent } from '@/lib/framework';

export interface AgentCMSRefBlockProps {
  index: number;
  block: RefInstructionBlock;
  onDelete?: (index: number) => void;
  onDereference?: (index: number, content: string) => void;
  className?: string;
  schema?: JsonSchema;
  readOnly?: boolean;
}

interface RefBlockContentProps {
  block: RefInstructionBlock;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
  onDereference?: (content: string) => void;
  schema?: JsonSchema;
  readOnly?: boolean;
}

const RefBlockContent = ({
  block,
  dragHandleProps,
  onDelete,
  onDereference,
  schema,
  readOnly = false,
}: RefBlockContentProps) => {
  const { data: promptBlock, isLoading } = useStoredPromptBlock(block.promptBlockId);
  const { updateStoredPromptBlock } = useStoredPromptBlockMutations(block.promptBlockId);

  // Runtime instruction resolution only includes PUBLISHED prompt blocks. A block
  // with no active version is a draft that the agent skips at runtime (resolving to
  // an empty section), even though it renders here in the draft-inclusive preview.
  // A published block with newer unpublished edits runs with the last published
  // version, not what's shown below. Surface both so the editor matches runtime.
  const isPublished = Boolean(promptBlock?.activeVersionId);
  const isDraft = Boolean(promptBlock) && !isPublished;
  const hasUnpublishedEdits = isPublished && Boolean(promptBlock?.hasDraft);
  const { navigate, paths } = useLinkComponent();
  // Local state for the editor so edits aren't lost on query refetch
  const [localContent, setLocalContent] = useState('');
  const hasInitialized = useRef(false);
  const hasUserEdited = useRef(false);

  // Reset sync flags when the referenced block changes
  useEffect(() => {
    hasInitialized.current = false;
    hasUserEdited.current = false;
  }, [block.promptBlockId]);

  // Sync from server on first load (or when promptBlockId changes)
  useEffect(() => {
    if (promptBlock?.content != null && !hasInitialized.current && !hasUserEdited.current) {
      setLocalContent(promptBlock.content);
      hasInitialized.current = true;
    }
  }, [promptBlock?.content]);

  // Debounce persisting to the server (500ms after last keystroke)
  const debouncedSave = useDebouncedCallback((content: string) => {
    updateStoredPromptBlock.mutate({ content });
  }, 500);

  // Flush pending save on unmount so the last edit isn't lost
  useEffect(() => () => debouncedSave.flush(), [debouncedSave]);

  const handleContentChange = useCallback(
    (content: string) => {
      hasUserEdited.current = true;
      setLocalContent(content);
      debouncedSave(content);
    },
    [debouncedSave],
  );

  // "Used by" — find agents that reference this prompt block
  const { data: storedAgentsData } = useStoredAgents();
  const usedByAgents = useMemo(() => {
    if (!storedAgentsData?.agents) return [];
    return storedAgentsData.agents.filter(agent => {
      const instructions = agent.instructions;
      if (!Array.isArray(instructions)) return false;
      return instructions.some((instr: any) => instr.type === 'prompt_block_ref' && instr.id === block.promptBlockId);
    });
  }, [storedAgentsData?.agents, block.promptBlockId]);

  return (
    <div className="relative group rounded-md transition-colors duration-150 hover:bg-surface2/50">
      {/* Left gutter — drag handle (visible on hover/focus-within) */}
      {!readOnly && (
        <div className="absolute -left-8 top-1 flex flex-col items-center transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <div {...dragHandleProps} className="text-neutral3 hover:text-neutral6 cursor-grab active:cursor-grabbing">
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon>
                  <GripVertical />
                </Icon>
              </TooltipTrigger>
              <TooltipContent side="left">Drag to reorder</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Content area with left accent border */}
      <div className="border-l-2 border-accent3/30 pl-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-neutral3 py-3">
            <Spinner className="h-4 w-4" />
            <Txt variant="ui-sm">Loading prompt block...</Txt>
          </div>
        ) : promptBlock ? (
          <>
            {/* Sync-block header — always visible, with Popover on caret */}
            <div className="flex items-center gap-1.5 py-1 px-1 -ml-1">
              <Txt variant="ui-xs" className="text-neutral3 truncate">
                {promptBlock.name}
              </Txt>
              {isDraft && (
                <Badge variant="warning" className="shrink-0">
                  Draft
                </Badge>
              )}
              {hasUnpublishedEdits && (
                <Badge variant="warning" className="shrink-0">
                  Unpublished edits
                </Badge>
              )}
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Open actions for ${promptBlock.name}`}
                      className="ml-auto rounded p-0.5 hover:bg-surface4/50 transition-colors duration-150 text-neutral3 hover:text-neutral5"
                    >
                      <Icon className="h-3! w-3!">
                        <ChevronDown />
                      </Icon>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[280px] p-0">
                    <div className="p-3 border-b border-border1">
                      <Txt variant="ui-sm" className="font-medium text-neutral6">
                        {promptBlock.name}
                      </Txt>
                      {promptBlock.description && (
                        <Txt variant="ui-xs" className="text-neutral3 mt-0.5 line-clamp-2">
                          {promptBlock.description}
                        </Txt>
                      )}
                    </div>
                    <div className="p-1">
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded hover:bg-surface4/50 transition-colors text-neutral5 text-ui-xs"
                        onClick={() => navigate(paths.cmsPromptBlockEditLink(block.promptBlockId))}
                      >
                        <Icon className="h-3.5! w-3.5! text-neutral3">
                          <ExternalLink />
                        </Icon>
                        Open original
                      </button>
                      {onDereference && (
                        <button
                          type="button"
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded hover:bg-surface4/50 transition-colors text-neutral5 text-ui-xs"
                          onClick={() => {
                            debouncedSave.flush();
                            onDereference(localContent);
                          }}
                        >
                          <Icon className="h-3.5! w-3.5! text-neutral3">
                            <X />
                          </Icon>
                          De-reference block
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded hover:bg-surface4/50 transition-colors text-error text-ui-xs"
                          onClick={onDelete}
                        >
                          <Icon className="h-3.5! w-3.5!">
                            <X />
                          </Icon>
                          Remove block
                        </button>
                      )}
                    </div>
                    {usedByAgents.length > 0 && (
                      <div className="border-t border-border1 p-3">
                        <Txt variant="ui-xs" className="text-neutral3 mb-1.5">
                          Used by {usedByAgents.length} agent{usedByAgents.length !== 1 ? 's' : ''}
                        </Txt>
                        <div className="flex flex-col gap-1">
                          {usedByAgents.map(agent => (
                            <Txt key={agent.id} variant="ui-xs" className="text-neutral5 truncate">
                              {agent.name}
                            </Txt>
                          ))}
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Runtime mismatch warning — draft refs resolve empty at runtime */}
            {isDraft && (
              <div className="flex items-start gap-1.5 py-1 px-1 -ml-1 text-warning">
                <Icon className="h-3.5! w-3.5! mt-0.5 shrink-0">
                  <AlertTriangle />
                </Icon>
                <Txt variant="ui-xs">
                  This prompt block is an unpublished draft. The agent skips it at runtime until the block is published,
                  so this content will not be part of the agent's instructions yet.
                </Txt>
              </div>
            )}
            {hasUnpublishedEdits && (
              <div className="flex items-start gap-1.5 py-1 px-1 -ml-1 text-neutral3">
                <Icon className="h-3.5! w-3.5! mt-0.5 shrink-0">
                  <AlertTriangle />
                </Icon>
                <Txt variant="ui-xs">
                  This block has unpublished edits. The agent runs the last published version at runtime, not the
                  changes shown here, until the block is published.
                </Txt>
              </div>
            )}

            {/* Editable content */}
            <CodeEditor
              value={localContent}
              onChange={handleContentChange}
              placeholder="Referenced block is empty..."
              variant="embedded"
              className="min-h-12"
              language="markdown"
              highlightVariables
              showCopyButton={false}
              schema={schema}
              lineNumbers={false}
              editable={!readOnly}
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-warning py-3">
            <Txt variant="ui-sm">Prompt block not found (ID: {block.promptBlockId})</Txt>
          </div>
        )}
      </div>
    </div>
  );
};

export const AgentCMSRefBlock = ({
  index,
  block,
  onDelete,
  onDereference,
  className,
  schema,
  readOnly = false,
}: AgentCMSRefBlockProps) => {
  return (
    <ContentBlock index={index} draggableId={block.id} className={cn('', className)}>
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <RefBlockContent
          block={block}
          dragHandleProps={dragHandleProps}
          onDelete={readOnly || !onDelete ? undefined : () => onDelete(index)}
          onDereference={readOnly || !onDereference ? undefined : (content: string) => onDereference(index, content)}
          schema={schema}
          readOnly={readOnly}
        />
      )}
    </ContentBlock>
  );
};
