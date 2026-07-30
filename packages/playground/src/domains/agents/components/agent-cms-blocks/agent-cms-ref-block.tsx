import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { ContentBlock } from '@mastra/playground-ui/components/ContentBlocks';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import { GripVertical, X, ExternalLink, ChevronDown } from 'lucide-react';
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
    <div className="group hover:bg-surface2/50 relative rounded-md transition-colors duration-150">
      {/* Left gutter — drag handle (visible on hover/focus-within) */}
      {!readOnly && (
        <div className="absolute top-1 -left-8 flex flex-col items-center opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
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
      <div className="border-accent3/30 border-l-2 pl-3">
        {isLoading ? (
          <div className="text-neutral3 flex items-center gap-2 py-3">
            <Spinner className="h-4 w-4" />
            <Txt variant="ui-sm">Loading prompt block...</Txt>
          </div>
        ) : promptBlock ? (
          <>
            {/* Sync-block header — always visible, with Popover on caret */}
            <div className="-ml-1 flex items-center gap-1.5 px-1 py-1">
              <Txt variant="ui-xs" className="text-neutral3 truncate">
                {promptBlock.name}
              </Txt>
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Open actions for ${promptBlock.name}`}
                      className="hover:bg-surface4/50 text-neutral3 hover:text-neutral5 ml-auto rounded p-0.5 transition-colors duration-150"
                    >
                      <Icon className="h-3! w-3!">
                        <ChevronDown />
                      </Icon>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[280px] p-0">
                    <div className="border-border1 border-b p-3">
                      <Txt variant="ui-sm" className="text-neutral6 font-medium">
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
                        className="hover:bg-surface4/50 text-neutral5 text-ui-xs flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
                        onClick={() => navigate(paths.cmsPromptBlockEditLink(block.promptBlockId))}
                      >
                        <Icon className="text-neutral3 h-3.5! w-3.5!">
                          <ExternalLink />
                        </Icon>
                        Open original
                      </button>
                      {onDereference && (
                        <button
                          type="button"
                          className="hover:bg-surface4/50 text-neutral5 text-ui-xs flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
                          onClick={() => {
                            debouncedSave.flush();
                            onDereference(localContent);
                          }}
                        >
                          <Icon className="text-neutral3 h-3.5! w-3.5!">
                            <X />
                          </Icon>
                          De-reference block
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="hover:bg-surface4/50 text-error text-ui-xs flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
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
                      <div className="border-border1 border-t p-3">
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
          <div className="text-warning flex items-center gap-2 py-3">
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
