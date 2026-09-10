import { ChevronUpIcon, CopyIcon, CheckIcon, FolderTree, HardDrive } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { CodeEditor } from '../../../ds/components/CodeEditor';
import { Icon } from '../../../ds/icons/Icon';
import { useCopyToClipboard } from '../../../hooks/use-copy-to-clipboard';
import { cn } from '../../../utils/cn';
import { SectionLabel } from './section-label';
import type { ToolApprovalControlsProps } from './tool-approval-controls';
import { ToolApprovalControls } from './tool-approval-controls';
import type { DataMessagePart } from './tool-data';

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

export interface FileTreeMessageProps extends ToolApprovalControlsProps {
  toolName: string;
  args: Record<string, unknown> | string;
  result: unknown;
  toolCallId: string;
  onNavigate?: (href: string) => void;
  approvalRequired?: boolean;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

export const FileTreeMessage = ({
  toolName,
  args,
  result,
  toolCallId,
  approvalRequired,
  isRunning: approvalRunning,
  status,
  onApprove,
  onDecline,
  onNavigate,
  toolCalled: toolCalledProp,
  dataParts,
}: FileTreeMessageProps) => {
  // Expand by default when approval is required (so buttons are visible)
  const [isCollapsed, setIsCollapsed] = useState(!approvalRequired);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

  // Sync collapsed state when approvalRequired changes (like BadgeWrapper does)
  useEffect(() => {
    setIsCollapsed(!approvalRequired);
  }, [approvalRequired]);

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
        {wsMeta?.filesystem && onNavigate && (
          <a
            onClick={event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              onNavigate(wsMeta.id ? `/workspaces/${wsMeta.id}?path=${encodeURIComponent(path)}` : '/workspaces');
            }}
            href={wsMeta.id ? `/workspaces/${wsMeta.id}?path=${encodeURIComponent(path)}` : '/workspaces'}
            className="border-border1 bg-surface3 text-neutral6 hover:border-border2 hover:bg-surface4 flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs transition-colors"
          >
            <HardDrive className="size-3" />
            <span>{wsMeta.name || wsMeta.filesystem.name}</span>
          </a>
        )}

        {/* Summary - show in header when collapsed */}
        {isCollapsed && hasResult && summary && <span className="text-neutral6 text-xs">{summary}</span>}
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div className="pt-2">
          {/* Approval UI - styled like ToolBadge/BadgeWrapper when awaiting approval */}
          {approvalRequired && !toolCalled && (
            <div className="bg-surface2 flex flex-col gap-4 rounded-lg p-4">
              <div>
                <SectionLabel>Tool arguments</SectionLabel>
                <CodeEditor data={parsedArgs as Record<string, unknown>} data-testid="tool-args" />
              </div>
              <ToolApprovalControls
                isRunning={approvalRunning}
                status={status}
                onApprove={onApprove}
                onDecline={onDecline}
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
              <pre className="text-mastra-el-6 max-h-dropdown-max-height overflow-auto p-3 font-mono text-xs whitespace-pre">
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
