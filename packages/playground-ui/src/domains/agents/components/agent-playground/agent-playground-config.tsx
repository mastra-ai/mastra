import { ChevronDown, ChevronRight, Wrench, Cpu, Eye, Pencil, PlusIcon, XIcon } from 'lucide-react';
import { useState, useMemo } from 'react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { Badge } from '@/ds/components/Badge';
import { Spinner } from '@/ds/components/Spinner';
import { HoverPopover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { cn } from '@/lib/utils';

import { InstructionBlocksPage } from '../agent-cms-pages/instruction-blocks-page';
import { ToolsPage } from '../agent-cms-pages/tools-page';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useCompareAgentVersions } from '../../hooks/use-agent-versions';
import { usePreviewInstructions } from '../../hooks/use-preview-instructions';
import type { JsonSchema } from '@/lib/json-schema';

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  headerAction,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border1">
      <div
        className={cn(
          'group flex items-center gap-2 px-4 py-3 hover:bg-surface3 transition-colors',
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

function InstructionsDiffView({ previousBlocks, currentBlocks }: { previousBlocks: unknown; currentBlocks: unknown }) {
  const prevBlocksArr = Array.isArray(previousBlocks) ? previousBlocks : [];
  const currBlocksArr = Array.isArray(currentBlocks) ? currentBlocks : [];

  const {
    data: prevText,
    isLoading: isLoadingPrev,
    isError: isPrevError,
  } = usePreviewInstructions(prevBlocksArr.length > 0 ? prevBlocksArr : undefined, prevBlocksArr.length > 0);
  const {
    data: currText,
    isLoading: isLoadingCurr,
    isError: isCurrError,
  } = usePreviewInstructions(currBlocksArr.length > 0 ? currBlocksArr : undefined, currBlocksArr.length > 0);

  if (isLoadingPrev || isLoadingCurr) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  if (isPrevError || isCurrError) {
    return (
      <Txt variant="ui-sm" className="text-red-400 py-2">
        Failed to load instruction preview
      </Txt>
    );
  }

  const oldStr = prevText ?? '';
  const newStr = currText ?? '';

  if (oldStr === newStr) {
    return (
      <div className="rounded-md border border-border1 bg-surface2 p-3">
        <Txt variant="ui-sm" className="text-neutral4 whitespace-pre-wrap font-mono">
          {oldStr || '(empty)'}
        </Txt>
      </div>
    );
  }

  const diffLines = computeLineDiff(oldStr, newStr);

  return (
    <div className="rounded-md border border-border1 overflow-hidden font-mono text-sm">
      {diffLines.map((line, idx) => (
        <div
          key={idx}
          className={cn(
            'px-3 py-0.5 whitespace-pre-wrap break-words',
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

function ReadOnlyInstructions({ blocks }: { blocks: unknown }) {
  const blocksArr = Array.isArray(blocks) ? blocks : [];
  const { data: text, isLoading } = usePreviewInstructions(
    blocksArr.length > 0 ? blocksArr : undefined,
    blocksArr.length > 0,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border1 bg-surface2 p-3">
      <Txt variant="ui-sm" className="text-neutral4 whitespace-pre-wrap font-mono">
        {text || '(empty)'}
      </Txt>
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
      <CollapsibleSection title="System Prompt" icon={<Cpu />} defaultOpen badge={instructionsBadge}>
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

  const variableEntries = useMemo(() => {
    const props = variables?.properties ?? {};
    return Object.entries(props);
  }, [variables]);

  const handleAddVariable = () => {
    const props = { ...(variables?.properties ?? {}) };
    let name = 'newVariable';
    let i = 1;
    while (props[name]) {
      name = `newVariable${i++}`;
    }
    props[name] = { type: 'string' };
    form.setValue('variables', { ...variables, type: 'object', properties: props }, { shouldDirty: true });
  };

  const handleRemoveVariable = (name: string) => {
    const props = { ...(variables?.properties ?? {}) };
    const required = Array.isArray(variables?.required)
      ? variables.required.filter((r: string) => r !== name)
      : undefined;
    delete props[name];
    form.setValue(
      'variables',
      { ...variables, type: 'object', properties: props, ...(required?.length ? { required } : {}) },
      { shouldDirty: true },
    );
  };

  const handleRenameVariable = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    const props = { ...(variables?.properties ?? {}) };
    if (props[newName]) return; // don't overwrite existing
    const required = Array.isArray(variables?.required)
      ? variables.required.map((r: string) => (r === oldName ? newName : r))
      : undefined;
    const value = props[oldName];
    delete props[oldName];
    props[newName] = value;
    form.setValue(
      'variables',
      { ...variables, type: 'object', properties: props, ...(required?.length ? { required } : {}) },
      { shouldDirty: true },
    );
  };

  const handleVariableValueChange = (name: string, value: string) => {
    const props = { ...(variables?.properties ?? {}) };
    props[name] = { ...props[name], default: value };
    form.setValue('variables', { ...variables, type: 'object', properties: props }, { shouldDirty: true });
  };

  const showDiff = readOnly && !!selectedVersionId && !!latestVersionId && selectedVersionId !== latestVersionId;

  return (
    <div className={cn('flex flex-col h-full')}>
      <div className="px-4 py-3 border-b border-border1">
        {/* <Txt variant="ui-xs" className="font-medium text-red uppercase tracking-wider">
          Configuration
        </Txt> */}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {showDiff ? (
          <ReadOnlyConfigWithDiff
            agentId={agentId}
            selectedVersionId={selectedVersionId}
            latestVersionId={latestVersionId}
          />
        ) : (
          <>
            <CollapsibleSection title="System Prompt" icon={<Cpu />} defaultOpen>
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

                <div className="flex items-center justify-between">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(prev => !prev)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-neutral3 hover:text-neutral5 hover:bg-surface3"
                    >
                      <Icon size="sm">{showPreview ? <Pencil /> : <Eye />}</Icon>
                      {showPreview ? 'Edit' : 'Preview'}
                    </button>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={handleAddVariable}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-neutral3 hover:text-neutral5 hover:bg-surface3"
                    >
                      <Icon size="sm">
                        <PlusIcon />
                      </Icon>
                      Add Variable
                    </button>
                  )}
                </div>

                {variableEntries.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {variableEntries.map(([name, schema]) => (
                      <div
                        key={name}
                        className="flex items-center gap-2 rounded-md border border-border1 bg-surface3 px-3 py-1.5"
                      >
                        {readOnly ? (
                          <Txt variant="ui-sm" className="text-neutral5 font-mono shrink-0">
                            {`{{${name}}}`}
                          </Txt>
                        ) : (
                          <input
                            type="text"
                            defaultValue={name}
                            onBlur={e => handleRenameVariable(name, e.target.value.trim())}
                            placeholder="key"
                            className="w-24 shrink-0 text-ui-sm font-mono text-neutral5 bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-0"
                            aria-label={`Variable name: ${name}`}
                          />
                        )}
                        <span className="text-neutral3 text-ui-sm shrink-0">=</span>
                        {readOnly ? (
                          <Txt variant="ui-sm" className="text-neutral3 flex-1 truncate">
                            {schema.default != null ? String(schema.default) : ''}
                          </Txt>
                        ) : (
                          <input
                            type="text"
                            defaultValue={schema.default != null ? String(schema.default) : ''}
                            onBlur={e => handleVariableValueChange(name, e.target.value)}
                            placeholder="value"
                            className="flex-1 min-w-0 text-ui-sm text-neutral3 bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-0"
                            aria-label={`Variable value: ${name}`}
                          />
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(name)}
                            className="text-neutral3 hover:text-neutral5 transition-colors focus-visible:outline-none focus-visible:ring-0 shrink-0"
                            aria-label={`Remove variable ${name}`}
                          >
                            <Icon size="sm">
                              <XIcon />
                            </Icon>
                          </button>
                        )}
                      </div>
                    ))}
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
