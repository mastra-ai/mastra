import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronUpIcon, CopyIcon, CheckIcon, FolderTree, HardDrive } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import type { DataMessagePart } from '../tool-card';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';
import { useLinkComponent } from '@/lib/framework';

// Matches the shape returned by workspace.getInfo()
interface WorkspaceMetadata {
  toolName?: string;
  id?: string;
  name?: string;
  status?: string;
  filesystem?: {
    id?: string;
    name?: string;
    provider?: string;
    status?: string;
  };
  sandbox?: {
    id?: string;
    name?: string;
    provider?: string;
    status?: string;
  };
}

interface ParsedArgs {
  path?: string;
  maxDepth?: number;
  showHidden?: boolean;
  dirsOnly?: boolean;
  exclude?: string;
  extension?: string;
}

export interface FileTreeBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

export const FileTreeBadge = ({
  toolName,
  args,
  result,
  toolCallId,
  toolApprovalMetadata,
  isNetwork,
  toolCalled: toolCalledProp,
  dataParts,
}: FileTreeBadgeProps) => {
  // Expand by default when approval is required (so buttons are visible)
  const [isCollapsed, setIsCollapsed] = useState(!toolApprovalMetadata);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

  // Sync collapsed state when toolApprovalMetadata changes (like BadgeWrapper does)
  useEffect(() => {
    setIsCollapsed(!toolApprovalMetadata);
  }, [toolApprovalMetadata]);
  const { Link } = useLinkComponent();

  // Parse args
  let parsedArgs: ParsedArgs = { path: '.' };
  try {
    parsedArgs = typeof args === 'object' ? (args as ParsedArgs) : JSON.parse(args);
  } catch {
    // ignore
  }

  const { path = '.', maxDepth, showHidden, dirsOnly, exclude, extension } = parsedArgs;

  // Build args display string
  const argsDisplay: string[] = [];
  if (maxDepth !== undefined && maxDepth !== 3) {
    argsDisplay.push(`depth: ${maxDepth}`);
  }
  if (showHidden) {
    argsDisplay.push('hidden');
  }
  if (dirsOnly) {
    argsDisplay.push('dirs only');
  }
  if (exclude) {
    argsDisplay.push(`exclude: ${exclude}`);
  }
  if (extension) {
    argsDisplay.push(`ext: ${extension}`);
  }

  // Get tree output + summary from result string: "tree\n\nsummary"
  let treeOutput = '';
  let summary = '';
  if (typeof result === 'string' && result) {
    const lastDoubleNewline = result.lastIndexOf('\n\n');
    if (lastDoubleNewline !== -1) {
      treeOutput = result.slice(0, lastDoubleNewline);
      summary = result.slice(lastDoubleNewline + 2);
    } else {
      treeOutput = result;
    }
  }

  const hasResult = !!treeOutput;
  const toolCalled = toolCalledProp ?? hasResult;

  // Extract filesystem metadata from message data parts (via writer.custom), scoped to this tool call
  const workspaceMetadata = useMemo(() => {
    return (dataParts ?? []).find(
      part => part.type === 'data' && part.name === 'workspace-metadata' && part.data?.toolCallId === toolCallId,
    );
  }, [dataParts, toolCallId]);

  const wsMeta = workspaceMetadata?.data as WorkspaceMetadata | undefined;

  const onCopy = () => {
    if (!treeOutput || isCopied) return;
    copyToClipboard(treeOutput);
  };

  return (
    <div className="mb-4" data-testid="file-tree-badge">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setIsCollapsed(s => !s)} className="flex min-w-0 items-center gap-2" type="button">
          <Icon>
            <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge icon={<FolderTree className="text-accent6" size={16} />}>
            List Files <span className="text-neutral6 ml-1 font-normal">{path}</span>
            {argsDisplay.length > 0 && (
              <span className="text-neutral4 ml-1 font-normal">({argsDisplay.join(', ')})</span>
            )}
          </Badge>
        </button>

        {/* Filesystem badge - outside button to prevent overlap */}
        {wsMeta?.filesystem && (
          <Link
            href={wsMeta.id ? `/workspaces/${wsMeta.id}?path=${encodeURIComponent(path)}` : '/workspaces'}
            className="text-neutral6 bg-surface3 border-border1 hover:bg-surface4 hover:border-border2 flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs transition-colors"
          >
            <HardDrive className="size-3" />
            <span>{wsMeta.name || wsMeta.filesystem.name}</span>
          </Link>
        )}

        {/* Summary - show in header when collapsed */}
        {isCollapsed && hasResult && summary && <span className="text-neutral6 text-xs">{summary}</span>}
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div className="pt-2">
          {/* Approval UI - styled like ToolBadge/BadgeWrapper when awaiting approval */}
          {toolApprovalMetadata && !toolCalled && (
            <div className="bg-surface2 flex flex-col gap-4 rounded-lg p-4">
              <div>
                <p className="pb-2 font-medium">Tool arguments</p>
                <CodeEditor data={parsedArgs as Record<string, unknown>} data-testid="tool-args" />
              </div>
              <ToolApprovalButtons
                toolCalled={toolCalled}
                toolCallId={toolCallId}
                toolApprovalMetadata={toolApprovalMetadata}
                toolName={toolName}
                isNetwork={isNetwork}
              />
            </div>
          )}

          {/* Tree output panel - custom UI after tool has been called */}
          {toolCalled && treeOutput && (
            <div className="border-border1 bg-surface2 overflow-hidden rounded-md border">
              {/* Panel header with summary and copy button */}
              <div className="border-border1 bg-surface3 flex items-center justify-between border-b px-3 py-1.5">
                {summary && <span className="text-neutral6 text-xs">{summary}</span>}
                <Button variant="default" size="icon-sm" tooltip="Copy tree" onClick={onCopy} disabled={!treeOutput}>
                  <span className="grid">
                    <span
                      style={{ gridArea: '1/1' }}
                      className={cn('transition-transform', isCopied ? 'scale-100' : 'scale-0')}
                    >
                      <CheckIcon size={14} />
                    </span>
                    <span
                      style={{ gridArea: '1/1' }}
                      className={cn('transition-transform', isCopied ? 'scale-0' : 'scale-100')}
                    >
                      <CopyIcon size={14} />
                    </span>
                  </span>
                </Button>
              </div>

              {/* Tree content */}
              <pre className="text-mastra-el-6 max-h-dropdown-max-height overflow-x-auto overflow-y-auto p-3 font-mono text-xs whitespace-pre">
                {treeOutput}
              </pre>
            </div>
          )}

          {/* Loading state */}
          {toolCalled && !hasResult && (
            <div className="border-border1 bg-surface2 rounded-md border px-3 py-2">
              <span className="text-neutral6 text-xs">Loading...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
