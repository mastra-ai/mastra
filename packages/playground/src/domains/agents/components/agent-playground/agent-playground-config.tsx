import {
  Badge,
  CopyButton,
  HoverPopover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
  Spinner,
  Txt,
  Icon,
  cn,
} from '@mastra/playground-ui';
import type { JsonSchema, JsonSchemaProperty } from '@mastra/playground-ui';
import { Braces, ChevronDown, ChevronRight, Wrench, Cpu, Eye, Pencil } from 'lucide-react';
import { useState, useMemo } from 'react';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useCompareAgentVersions } from '../../hooks/use-agent-versions';
import { InstructionBlocksPage } from '../agent-cms-pages/instruction-blocks-page';
import { ToolsPage } from '../agent-cms-pages/tools-page';
import { useStoredPromptBlock } from '@/domains/prompt-blocks';

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  headerAction,
  defaultOpen = false,
  compact = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border1">
      <div
        className={cn(
          'group flex items-center gap-2 px-4 hover:bg-surface3 transition-colors',
          compact ? 'py-2' : 'py-3',
          isOpen && 'bg-surface3',
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Icon size="sm" className="text-neutral3">
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </Icon>
          <Icon size="sm" className="text-neutral3">
            {icon}
          </Icon>
          <Txt
            as="span"
            variant="ui-sm"
            className={cn(
              'font-normal text-neutral3 transition-colors group-hover:text-neutral5',
              isOpen && 'text-neutral5',
            )}
          >
            {title}
          </Txt>
        </button>
        <span className="ml-auto flex items-center gap-2">
          {headerAction}
          {badge}
        </span>
      </div>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only variable property renderer (recursive for nested objects)
// ---------------------------------------------------------------------------

function VariableProperty({ name, prop, depth }: { name: string; prop: JsonSchemaProperty; depth: number }) {
  const typeLabel = Array.isArray(prop.type) ? prop.type.filter((t: string) => t !== 'null').join(' | ') : prop.type;
  const hasChildren = prop.type === 'object' && prop.properties && Object.keys(prop.properties).length > 0;

  return (
    <div style={depth > 0 ? { paddingLeft: depth * 12 } : undefined}>
      <div className="flex items-center gap-2 py-1">
        <code className="text-xs text-accent1">{name}</code>
        <span className="text-[11px] text-neutral3">{typeLabel}</span>
        {prop.description && <span className="text-[11px] text-neutral3 italic truncate">— {prop.description}</span>}
      </div>
      {hasChildren && (
        <div className="border-l border-border1 ml-1">
          {Object.entries(prop.properties!).map(([childName, childProp]) => (
            <VariableProperty key={childName} name={childName} prop={childProp} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line-level diff algorithm
// ---------------------------------------------------------------------------

type DiffLine = { type: 'equal' | 'added' | 'removed'; text: string };

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'equal', text: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({ type: 'added', text: newLines[j - 1]! });
      j--;
    } else {
      result.push({ type: 'removed', text: oldLines[i - 1]! });
      i--;
    }
  }

  return result.reverse();
}

// ---------------------------------------------------------------------------
// Diff-aware read-only views
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Per-block content helpers (raw template text, not resolved)
// ---------------------------------------------------------------------------

function getRawBlockContent(block: Record<string, unknown>): string | null {
  if (block.type === 'prompt_block' && typeof block.content === 'string') {
    return block.content;
  }
  return null;
}

function RefBlockCopyContent({ promptBlockId }: { promptBlockId: string }) {
  const { data: promptBlock } = useStoredPromptBlock(promptBlockId);
  const content = promptBlock?.content ?? '';
  if (!content) return null;
  return <CopyButton content={content} tooltip="Copy prompt block text" size="sm" />;
}

function BlockCopyButton({ block }: { block: Record<string, unknown> }) {
  const rawContent = getRawBlockContent(block);
  if (rawContent) {
    return <CopyButton content={rawContent} tooltip="Copy prompt text" size="sm" />;
  }
  if (block.type === 'prompt_block_ref' && (typeof block.promptBlockId === 'string' || typeof block.id === 'string')) {
    return <RefBlockCopyContent promptBlockId={(block.promptBlockId as string) ?? (block.id as string)} />;
  }
  return null;
}

function InstructionsDiffView({ previousBlocks, currentBlocks }: { previousBlocks: unknown; currentBlocks: unknown }) {
  const prevBlocksArr = Array.isArray(previousBlocks) ? previousBlocks : [];
  const currBlocksArr = Array.isArray(currentBlocks) ? currentBlocks : [];

  // Build a map of current blocks by position for per-block comparison
  const currContentByIdx = currBlocksArr.map((b: Record<string, unknown>) => getRawBlockContent(b) ?? '');
  const prevContentByIdx = prevBlocksArr.map((b: Record<string, unknown>) => getRawBlockContent(b) ?? '');

  // If only one block on each side, show a simple diff
  if (prevBlocksArr.length <= 1 && currBlocksArr.length <= 1) {
    const oldStr = prevContentByIdx[0] ?? '';
    const newStr = currContentByIdx[0] ?? '';
    const block = prevBlocksArr[0] as Record<string, unknown> | undefined;

    if (oldStr === newStr) {
      return (
        <div className="relative rounded-md border border-border1 bg-surface2 p-3">
          {block && (
            <div className="absolute top-2 right-2">
              <BlockCopyButton block={block} />
            </div>
          )}
          <Txt variant="ui-sm" className="text-neutral4 whitespace-pre-wrap font-mono">
            {oldStr || '(empty)'}
          </Txt>
        </div>
      );
    }

    const diffLines = computeLineDiff(oldStr, newStr);
    return (
      <div className="relative rounded-md border border-border1 overflow-hidden font-mono text-sm">
        {block && (
          <div className="absolute top-2 right-2 z-10">
            <BlockCopyButton block={block} />
          </div>
        )}
        {diffLines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'px-3 py-0.5 whitespace-pre-wrap wrap-break-word',
              line.type === 'removed' && 'bg-red-950/20 text-red-300',
              line.type === 'added' && 'bg-green-950/20 text-green-300',
              line.type === 'equal' && 'text-neutral4',
            )}
          >
            <span className="inline-block w-4 shrink-0 text-neutral3/50 select-none mr-2">
              {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
            </span>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
    );
  }

  // Multiple blocks: show per-block with individual copy buttons
  const maxLen = Math.max(prevBlocksArr.length, currBlocksArr.length);
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: maxLen }, (_, idx) => {
        const prevBlock = prevBlocksArr[idx] as Record<string, unknown> | undefined;
        const currBlock = currBlocksArr[idx] as Record<string, unknown> | undefined;
        const oldStr = prevContentByIdx[idx] ?? '';
        const newStr = currContentByIdx[idx] ?? '';

        if (!prevBlock && currBlock) {
          return (
            <div key={idx} className="rounded-md border border-green-900/30 bg-green-950/10 p-3 font-mono text-sm">
              <Txt variant="ui-xs" className="text-green-400 mb-1">
                + Added block
              </Txt>
              <Txt variant="ui-sm" className="text-green-300 whitespace-pre-wrap">
                {newStr}
              </Txt>
            </div>
          );
        }

        if (prevBlock && !currBlock) {
          return (
            <div key={idx} className="relative rounded-md border border-red-900/30 bg-red-950/10 p-3 font-mono text-sm">
              <div className="absolute top-2 right-2">
                <BlockCopyButton block={prevBlock} />
              </div>
              <Txt variant="ui-xs" className="text-red-400 mb-1">
                − Removed in latest
              </Txt>
              <Txt variant="ui-sm" className="text-red-300 whitespace-pre-wrap">
                {oldStr}
              </Txt>
            </div>
          );
        }

        if (oldStr === newStr) {
          return (
            <div key={idx} className="relative rounded-md border border-border1 bg-surface2 p-3">
              {prevBlock && (
                <div className="absolute top-2 right-2">
                  <BlockCopyButton block={prevBlock} />
                </div>
              )}
              <Txt variant="ui-sm" className="text-neutral4 whitespace-pre-wrap font-mono">
                {oldStr || '(empty)'}
              </Txt>
            </div>
          );
        }

        const diffLines = computeLineDiff(oldStr, newStr);
        return (
          <div key={idx} className="relative rounded-md border border-border1 overflow-hidden font-mono text-sm">
            {prevBlock && (
              <div className="absolute top-2 right-2 z-10">
                <BlockCopyButton block={prevBlock} />
              </div>
            )}
            {diffLines.map((line, lidx) => (
              <div
                key={lidx}
                className={cn(
                  'px-3 py-0.5 whitespace-pre-wrap wrap-break-word',
                  line.type === 'removed' && 'bg-red-950/20 text-red-300',
                  line.type === 'added' && 'bg-green-950/20 text-green-300',
                  line.type === 'equal' && 'text-neutral4',
                )}
              >
                <span className="inline-block w-4 shrink-0 text-neutral3/50 select-none mr-2">
                  {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                </span>
                {line.text || '\u00A0'}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RefBlockPreview({ promptBlockId }: { promptBlockId: string }) {
  const { data: promptBlock, isLoading } = useStoredPromptBlock(promptBlockId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  const content = promptBlock?.content ?? '';
  return (
    <div className="relative rounded-md border border-border1 bg-surface2 p-3">
      {content && (
        <div className="absolute top-2 right-2">
          <CopyButton content={content} tooltip="Copy prompt block text" size="sm" />
        </div>
      )}
      {promptBlock?.name && (
        <Txt variant="ui-xs" className="text-neutral3 mb-1 font-medium">
          {promptBlock.name}
        </Txt>
      )}
      <Txt variant="ui-sm" className="text-neutral4 whitespace-pre-wrap font-mono">
        {content || '(empty)'}
      </Txt>
    </div>
  );
}

function ReadOnlyInstructions({ blocks }: { blocks: unknown }) {
  const blocksArr = Array.isArray(blocks) ? blocks : [];

  if (blocksArr.length === 0) {
    return (
      <Txt variant="ui-sm" className="text-neutral3 py-2">
        No instruction blocks configured
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {blocksArr.map((block: Record<string, unknown>, idx: number) => {
        if (block.type === 'prompt_block_ref') {
          const refId = (block.promptBlockId as string) ?? (block.id as string);
          return <RefBlockPreview key={refId ?? idx} promptBlockId={refId} />;
        }

        const content = typeof block.content === 'string' ? block.content : '';
        return (
          <div key={(block.id as string) ?? idx} className="relative rounded-md border border-border1 bg-surface2 p-3">
            {content && (
              <div className="absolute top-2 right-2">
                <CopyButton content={content} tooltip="Copy prompt text" size="sm" />
              </div>
            )}
            <Txt variant="ui-sm" className="text-neutral4 whitespace-pre-wrap font-mono">
              {content || '(empty)'}
            </Txt>
          </div>
        );
      })}
    </div>
  );
}

function ToolsDiffView({
  previousTools,
  currentTools,
}: {
  previousTools: Record<string, unknown> | undefined;
  currentTools: Record<string, unknown> | undefined;
}) {
  const prevKeys = new Set(previousTools ? Object.keys(previousTools) : []);
  const currKeys = new Set(currentTools ? Object.keys(currentTools) : []);

  const allKeys = [...new Set([...prevKeys, ...currKeys])].sort();

  return (
    <div className="flex flex-col gap-1.5">
      {allKeys.map(tool => {
        const inPrev = prevKeys.has(tool);
        const inCurr = currKeys.has(tool);

        let status: 'same' | 'added' | 'removed';
        if (inPrev && inCurr) status = 'same';
        else if (inPrev) status = 'removed';
        else status = 'added';

        return (
          <div
            key={tool}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5',
              status === 'removed' && 'border-red-900/30 bg-red-950/10',
              status === 'added' && 'border-green-900/30 bg-green-950/10',
              status === 'same' && 'border-border1 bg-surface2',
            )}
          >
            <Txt
              variant="ui-sm"
              className={cn(
                'font-mono',
                status === 'removed' && 'text-red-300 line-through',
                status === 'added' && 'text-green-300',
                status === 'same' && 'text-neutral5',
              )}
            >
              {tool}
            </Txt>
            {status === 'removed' && (
              <Badge variant="error" className="ml-auto">
                removed in latest
              </Badge>
            )}
            {status === 'added' && (
              <Badge variant="success" className="ml-auto">
                added in latest
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReadOnlyTools({ tools }: { tools: Record<string, unknown> | undefined }) {
  const entries = tools ? Object.entries(tools) : [];

  if (entries.length === 0) {
    return (
      <Txt variant="ui-sm" className="text-neutral3 py-2">
        No tools configured
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([id, config]) => (
        <div key={id} className="rounded-md border border-border1 bg-surface2 px-3 py-1.5">
          <Txt variant="ui-sm" className="text-neutral5 font-mono">
            {id}
          </Txt>
          {(config as Record<string, unknown>)?.description ? (
            <Txt variant="ui-xs" className="text-neutral3 mt-0.5">
              {String((config as Record<string, unknown>).description)}
            </Txt>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function VariablesDiffView({
  previousVars,
  currentVars,
}: {
  previousVars: Record<string, unknown> | undefined;
  currentVars: Record<string, unknown> | undefined;
}) {
  const prevProps = (previousVars as Record<string, Record<string, unknown>> | undefined)?.properties ?? {};
  const currProps = (currentVars as Record<string, Record<string, unknown>> | undefined)?.properties ?? {};

  const prevKeys = new Set(Object.keys(prevProps));
  const currKeys = new Set(Object.keys(currProps));
  const allKeys = [...new Set([...prevKeys, ...currKeys])].sort();

  if (allKeys.length === 0) {
    return (
      <Txt variant="ui-sm" className="text-neutral3 py-2">
        No variables configured
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {allKeys.map(name => {
        const inPrev = prevKeys.has(name);
        const inCurr = currKeys.has(name);

        let status: 'same' | 'added' | 'removed';
        if (inPrev && inCurr) status = 'same';
        else if (inPrev) status = 'removed';
        else status = 'added';

        return (
          <div
            key={name}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5',
              status === 'removed' && 'border-red-900/30 bg-red-950/10',
              status === 'added' && 'border-green-900/30 bg-green-950/10',
              status === 'same' && 'border-border1 bg-surface2',
            )}
          >
            <Txt
              variant="ui-sm"
              className={cn(
                'font-mono',
                status === 'removed' && 'text-red-300 line-through',
                status === 'added' && 'text-green-300',
                status === 'same' && 'text-neutral5',
              )}
            >
              {`{{${name}}}`}
            </Txt>
            {status === 'removed' && (
              <Badge variant="error" className="ml-auto">
                removed in latest
              </Badge>
            )}
            {status === 'added' && (
              <Badge variant="success" className="ml-auto">
                added in latest
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReadOnlyVariables({ variables }: { variables: Record<string, unknown> | undefined }) {
  const props = (variables as Record<string, Record<string, unknown>> | undefined)?.properties ?? {};
  const entries = Object.entries(props);

  if (entries.length === 0) {
    return (
      <Txt variant="ui-sm" className="text-neutral3 py-2">
        No variables configured
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([name, schema]) => (
        <div key={name} className="flex items-center gap-2 rounded-md border border-border1 bg-surface2 px-3 py-1.5">
          <Txt variant="ui-sm" className="text-neutral5 font-mono">
            {`{{${name}}}`}
          </Txt>
          {(schema as Record<string, unknown>)?.type ? (
            <Badge variant="default">{String((schema as Record<string, unknown>).type)}</Badge>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only config with diff highlighting
// ---------------------------------------------------------------------------

function ReadOnlyConfigWithDiff({
  agentId,
  selectedVersionId,
  latestVersionId,
}: {
  agentId: string;
  selectedVersionId: string;
  latestVersionId: string;
}) {
  const { form } = useAgentEditFormContext();
  const tools = form.watch('tools');
  const variables = form.watch('variables');
  const instructionBlocks = form.watch('instructionBlocks');
  const toolCount = tools ? Object.keys(tools).length : 0;

  const { data: compareData, isLoading: isLoadingCompare } = useCompareAgentVersions({
    agentId,
    fromVersionId: selectedVersionId,
    toVersionId: latestVersionId,
  });

  const diffMap = useMemo(() => {
    const map = new Map<string, { previousValue: unknown; currentValue: unknown }>();
    if (compareData?.diffs) {
      for (const diff of compareData.diffs) {
        map.set(diff.field, { previousValue: diff.previousValue, currentValue: diff.currentValue });
      }
    }
    return map;
  }, [compareData]);

  const instructionsDiff = diffMap.get('instructions');
  const toolsDiff = diffMap.get('tools');
  const variablesDiff = diffMap.get('requestContextSchema');

  const instructionsBadge = instructionsDiff ? <Badge variant="warning">modified</Badge> : null;
  const toolsBadge = toolsDiff ? (
    <Badge variant="warning">modified</Badge>
  ) : toolCount > 0 ? (
    <Badge variant="default">{`${toolCount}`}</Badge>
  ) : null;
  const variablesBadge = variablesDiff ? <Badge variant="warning">modified</Badge> : null;

  if (isLoadingCompare) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <>
      <CollapsibleSection title="System Prompt" icon={<Cpu />} badge={instructionsBadge}>
        {instructionsDiff ? (
          <InstructionsDiffView
            previousBlocks={instructionsDiff.previousValue}
            currentBlocks={instructionsDiff.currentValue}
          />
        ) : (
          <ReadOnlyInstructions blocks={instructionBlocks} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Tools" icon={<Wrench />} badge={toolsBadge}>
        {toolsDiff ? (
          <ToolsDiffView
            previousTools={toolsDiff.previousValue as Record<string, unknown> | undefined}
            currentTools={toolsDiff.currentValue as Record<string, unknown> | undefined}
          />
        ) : (
          <ReadOnlyTools tools={tools as Record<string, unknown> | undefined} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Variables" icon={<Wrench />} badge={variablesBadge}>
        {variablesDiff ? (
          <VariablesDiffView
            previousVars={variablesDiff.previousValue as Record<string, unknown> | undefined}
            currentVars={variablesDiff.currentValue as Record<string, unknown> | undefined}
          />
        ) : (
          <ReadOnlyVariables variables={variables as Record<string, unknown> | undefined} />
        )}
      </CollapsibleSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AgentPlaygroundConfigProps {
  agentId: string;
  selectedVersionId?: string;
  latestVersionId?: string;
}

export function AgentPlaygroundConfig({ agentId, selectedVersionId, latestVersionId }: AgentPlaygroundConfigProps) {
  const { form, readOnly } = useAgentEditFormContext();
  const tools = form.watch('tools');
  const instructionBlocks = form.watch('instructionBlocks');
  const variables = form.watch('variables') as JsonSchema | undefined;
  const toolCount = tools ? Object.keys(tools).length : 0;
  const [showPreview, setShowPreview] = useState(false);

  const variableEntries = useMemo(() => Object.entries(variables?.properties ?? {}), [variables]);

  const showDiff = readOnly && !!selectedVersionId && !!latestVersionId && selectedVersionId !== latestVersionId;

  return (
    <div className={cn('flex flex-col h-full')}>
      <div className="px-4 py-3 border-b border-border1" />

      <ScrollArea className="flex-1 min-h-0">
        {showDiff ? (
          <ReadOnlyConfigWithDiff
            agentId={agentId}
            selectedVersionId={selectedVersionId}
            latestVersionId={latestVersionId}
          />
        ) : (
          <>
            <CollapsibleSection title="Variables" icon={<Braces />} compact>
              <div className="flex flex-col gap-1 px-4 pt-2 pb-3">
                {variableEntries.length > 0 ? (
                  <div className="flex flex-col">
                    {variableEntries.map(([name, prop]) => (
                      <VariableProperty key={name} name={name} prop={prop} depth={0} />
                    ))}
                  </div>
                ) : null}
                <Txt variant="ui-xs" className="text-neutral3 mt-1">
                  {variableEntries.length > 0
                    ? 'Defined via requestContextSchema in code.'
                    : 'No variables defined. Add a requestContextSchema to your agent to define variables.'}
                </Txt>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="System Prompt" icon={<Cpu />}>
              <div className="flex flex-col gap-3 pt-4 px-4 pb-2">
                <Txt variant="ui-sm" className="font-normal text-neutral3">
                  Add instruction blocks to your agent. Blocks are combined in order to form the system prompt. You can{' '}
                  <HoverPopover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-neutral3 underline decoration-dotted hover:text-neutral5 cursor-pointer inline"
                      >
                        use variables
                      </button>
                    </PopoverTrigger>{' '}
                    as part of your instruction blocks.
                    <PopoverContent side="bottom" align="start">
                      <p className="text-ui-sm text-neutral5">
                        Use <code className="text-accent1 font-medium">{'{{variableName}}'}</code> syntax to insert
                        dynamic values into your instruction blocks.
                      </p>
                    </PopoverContent>
                  </HoverPopover>
                </Txt>

                {!readOnly && (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowPreview(prev => !prev)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-neutral3 hover:text-neutral5 hover:bg-surface3"
                    >
                      <Icon size="sm">{showPreview ? <Pencil /> : <Eye />}</Icon>
                      {showPreview ? 'Edit' : 'Preview'}
                    </button>
                  </div>
                )}
              </div>

              {readOnly || showPreview ? (
                <ReadOnlyInstructions blocks={instructionBlocks} />
              ) : (
                <InstructionBlocksPage />
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Tools"
              icon={<Wrench />}
              badge={toolCount > 0 ? <Badge variant="default">{`${toolCount}`}</Badge> : undefined}
            >
              <ToolsPage />
            </CollapsibleSection>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
