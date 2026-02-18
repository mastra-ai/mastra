import { useState, useEffect, useMemo } from 'react';
import { useAuiState } from '@assistant-ui/react';
import { cn } from '@/lib/utils';
import { ChevronUpIcon, CopyIcon, CheckIcon, FolderTree, HardDrive } from 'lucide-react';
import { IconButton } from '@/ds/components/IconButton';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { MastraUIMessage } from '@mastra/react';
import { useLinkComponent } from '@/lib/framework';
import { CodeEditor } from '@/ds/components/CodeEditor';

interface FilesystemInfo {
  id?: string;
  name?: string;
  provider?: string;
}

interface WorkspaceInfo {
  id?: string;
  name?: string;
}

interface FilesystemMetadata {
  workspace?: WorkspaceInfo;
  filesystem?: FilesystemInfo;
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
  metadata?: MastraUIMessage['metadata'];
  toolCalled?: boolean;
}

export const FileTreeBadge = ({
  toolName,
  args,
  result,
  toolCallId,
  toolApprovalMetadata,
  isNetwork,
  toolCalled: toolCalledProp,
}: FileTreeBadgeProps) => {
  // Expand by default when approval is required (so buttons are visible)
  const [isCollapsed, setIsCollapsed] = useState(!toolApprovalMetadata);
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  // Sync collapsed state when toolApprovalMetadata changes (like BadgeWrapper does)
  useEffect(() => {
    setIsCollapsed(!toolApprovalMetadata);
  }, [toolApprovalMetadata]);
  const { Link } = useLinkComponent();

  // Parse args
  let parsedArgs: ParsedArgs = { path: '/' };
  try {
    parsedArgs = typeof args === 'object' ? (args as ParsedArgs) : JSON.parse(args);
  } catch {
    // ignore
  }

  const { path = '/', maxDepth, showHidden, dirsOnly, exclude, extension } = parsedArgs;

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

  // Extract filesystem metadata from message data parts (via writer.custom)
  const message = useAuiState(s => s.message);
  const workspaceMetadata = useMemo(() => {
    const content = message.content as ReadonlyArray<{ type: string; name?: string; data?: any }>;
    return content.find(part => part.type === 'data' && part.name === 'workspace-metadata');
  }, [message.content]);

  const dataChunk = workspaceMetadata?.data;
  const fsMeta: FilesystemMetadata | undefined = dataChunk
    ? { workspace: dataChunk.workspace as WorkspaceInfo, filesystem: dataChunk.filesystem as FilesystemInfo }
    : undefined;

  // Prefer summary from data chunk if available (richer than parsed string)
  if (dataChunk?.summary && typeof dataChunk.summary === 'string') {
    summary = dataChunk.summary;
  }

  const onCopy = () => {
    if (!treeOutput || isCopied) return;
    copyToClipboard(treeOutput);
  };

  return (
    <div className="mb-4" data-testid="file-tree-badge">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setIsCollapsed(s => !s)} className="flex items-center gap-2 min-w-0" type="button">
          <Icon>
            <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge icon={<FolderTree className="text-accent6" size={16} />}>
            List Files <span className="text-icon6 font-normal ml-1">{path}</span>
            {argsDisplay.length > 0 && <span className="text-icon4 font-normal ml-1">({argsDisplay.join(', ')})</span>}
          </Badge>
        </button>

        {/* Filesystem badge - outside button to prevent overlap */}
        {fsMeta?.filesystem?.name && (
          <Link
            href={
              fsMeta.workspace?.id
                ? `/workspaces/${fsMeta.workspace.id}?path=${encodeURIComponent(path)}`
                : '/workspaces'
            }
            className="flex items-center gap-1.5 text-xs text-icon6 px-1.5 py-0.5 rounded bg-surface3 border border-border1 hover:bg-surface4 hover:border-border2 transition-colors"
          >
            <HardDrive className="size-3" />
            <span>{fsMeta.filesystem.name}</span>
          </Link>
        )}

        {/* Summary - show in header when collapsed */}
        {isCollapsed && hasResult && summary && <span className="text-icon6 text-xs">{summary}</span>}
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div className="pt-2">
          {/* Approval UI - styled like ToolBadge/BadgeWrapper when awaiting approval */}
          {toolApprovalMetadata && !toolCalled && (
            <div className="p-4 rounded-lg bg-surface2 flex flex-col gap-4">
              <div>
                <p className="font-medium pb-2">Tool arguments</p>
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
            <div className="rounded-md border border-border1 bg-surface2 overflow-hidden">
              {/* Panel header with summary and copy button */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border1 bg-surface3">
                {summary && <span className="text-icon6 text-xs">{summary}</span>}
                <IconButton variant="light" size="sm" tooltip="Copy tree" onClick={onCopy} disabled={!treeOutput}>
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
                </IconButton>
              </div>

              {/* Tree content */}
              <pre className="p-3 text-xs font-mono text-mastra-el-6 overflow-x-auto whitespace-pre max-h-[300px] overflow-y-auto">
                {treeOutput}
              </pre>
            </div>
          )}

          {/* Loading state */}
          {toolCalled && !hasResult && (
            <div className="rounded-md border border-border1 bg-surface2 px-3 py-2">
              <span className="text-xs text-icon6">Loading...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
