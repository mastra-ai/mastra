import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { RuleGroup, JsonSchema } from '@mastra/playground-ui';
import {
  Button,
  CodeEditor,
  ContentBlock,
  IconButton,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Txt,
  Icon,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { GripVertical, X, BookmarkPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { InstructionBlock, InlineInstructionBlock } from '../agent-edit-page/utils/form-validation';
import { AgentCMSRefBlock } from './agent-cms-ref-block';
import { DisplayConditionsDialog } from '@/domains/cms';
import { useStoredPromptBlockMutations } from '@/domains/prompt-blocks';

export interface AgentCMSBlockProps {
  index: number;
  block: InstructionBlock;
  onBlockChange: (block: InstructionBlock) => void;
  onDelete?: (index: number) => void;
  onDereference?: (index: number, content: string) => void;
  onConvertToRef?: (sourceBlockId: string, promptBlockId: string) => void;
  placeholder?: string;
  className?: string;
  schema?: JsonSchema;
  autoFocus?: boolean;
}

interface InlineBlockContentProps {
  index: number;
  block: InlineInstructionBlock;
  onBlockChange: (block: InstructionBlock) => void;
  onConvertToRef?: (blockId: string) => void;
  placeholder?: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onDelete?: () => void;
  schema?: JsonSchema;
  autoFocus?: boolean;
}

const SaveAsPromptBlockDialog = ({
  open,
  onOpenChange,
  onSave,
  isPending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => void;
  isPending: boolean;
  error: string | null;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!name.trim()) return;
      onSave(name.trim(), description.trim());
    },
    [name, description, onSave],
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save as prompt block</DialogTitle>
          <DialogDescription>Create a reusable prompt block from this content.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-block-name">Name</Label>
              <Input
                id="prompt-block-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Tone guidelines"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-block-description">Description (optional)</Label>
              <Input
                id="prompt-block-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            {error && (
              <Txt variant="ui-xs" className="text-error">
                {error}
              </Txt>
            )}
          </DialogBody>
          <DialogFooter className="px-6 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="cta" size="sm" disabled={!name.trim() || isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const InlineBlockContent = ({
  index,
  block,
  onBlockChange,
  onConvertToRef,
  placeholder,
  dragHandleProps,
  onDelete,
  schema,
  autoFocus = false,
}: InlineBlockContentProps) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { createStoredPromptBlock } = useStoredPromptBlockMutations();

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

  const handleSaveAsPromptBlock = useCallback(
    (name: string, description: string) => {
      setSaveError(null);
      createStoredPromptBlock.mutate(
        {
          name,
          description: description || undefined,
          content: block.content,
          rules: block.rules,
        },
        {
          onSuccess: data => {
            setSaveDialogOpen(false);
            onConvertToRef?.(data.id);
          },
          onError: (err: Error) => {
            setSaveError(err.message || 'Failed to create prompt block');
          },
        },
      );
    },
    [block.content, block.rules, createStoredPromptBlock, onConvertToRef],
  );

  return (
    <>
      <div className="relative group rounded-md transition-colors duration-150 hover:bg-surface2/50">
        {/* Left gutter — drag handle (visible on hover/focus-within) */}
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

        {/* Right toolbar — conditions + save as ref + delete (visible on hover/focus-within) */}
        <div className="absolute -right-1 top-1 z-10 flex items-center gap-0.5 transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <DisplayConditionsDialog
            entityName={`Block ${index + 1}`}
            schema={schema}
            rules={block.rules}
            onRulesChange={handleRulesChange}
          />

          {onConvertToRef && block.content.trim().length > 0 && (
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              tooltip="Save as prompt block"
            >
              <BookmarkPlus />
            </IconButton>
          )}

          {onDelete && (
            <IconButton variant="ghost" size="sm" onClick={onDelete} tooltip="Delete block">
              <X />
            </IconButton>
          )}
        </div>

        {/* CodeEditor — seamless, no border */}
        <CodeEditor
          ref={editorRef}
          value={block.content}
          onChange={handleContentChange}
          placeholder={placeholder}
          className="border-none rounded-none bg-transparent min-h-12"
          language="markdown"
          highlightVariables
          showCopyButton={false}
          schema={schema}
          autoFocus={autoFocus}
          lineNumbers={false}
        />
      </div>

      <SaveAsPromptBlockDialog
        open={saveDialogOpen}
        onOpenChange={open => {
          setSaveDialogOpen(open);
          if (open) setSaveError(null);
        }}
        onSave={handleSaveAsPromptBlock}
        isPending={createStoredPromptBlock.isPending}
        error={saveError}
      />
    </>
  );
};

export const AgentCMSBlock = ({
  index,
  block,
  onBlockChange,
  onDelete,
  onDereference,
  onConvertToRef,
  placeholder,
  className,
  schema,
  autoFocus,
}: AgentCMSBlockProps) => {
  if (block.type === 'prompt_block_ref') {
    return (
      <AgentCMSRefBlock
        index={index}
        block={block}
        onDelete={onDelete}
        onDereference={onDereference}
        className={className}
        schema={schema}
      />
    );
  }

  return (
    <ContentBlock index={index} draggableId={block.id} className={cn('', className)}>
      {(dragHandleProps: DraggableProvidedDragHandleProps | null) => (
        <InlineBlockContent
          index={index}
          block={block}
          onBlockChange={onBlockChange}
          onConvertToRef={
            onConvertToRef ? (promptBlockId: string) => onConvertToRef(block.id, promptBlockId) : undefined
          }
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
