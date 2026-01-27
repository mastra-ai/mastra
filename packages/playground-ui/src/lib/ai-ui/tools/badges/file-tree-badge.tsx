import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUpIcon, CopyIcon, CheckIcon, FolderTree, HardDrive } from 'lucide-react';
import { TooltipIconButton } from '../../tooltip-icon-button';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { MastraUIMessage } from '@mastra/react';
import { useLinkComponent } from '@/lib/framework';

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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { isCopied, copyToClipboard } = useCopyToClipboard();
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

  // Get tree output from result
  const treeOutput = result?.tree || '';
  const summary = result?.summary || '';
  const hasResult = !!treeOutput;
  const toolCalled = toolCalledProp ?? hasResult;

  // Extract filesystem metadata from result (if provided by the tool)
  const fsMeta: FilesystemMetadata | undefined = result?.metadata;

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
            href={`/workspace?${new URLSearchParams({
              ...(fsMeta.workspace?.id && { workspaceId: fsMeta.workspace.id }),
            }).toString()}`}
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
          {/* Tree output panel */}
          {toolCalled && hasResult && (
            <div className="rounded-md border border-border1 bg-surface2 overflow-hidden">
              {/* Panel header with summary and copy button */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border1 bg-surface3">
                {summary && <span className="text-icon6 text-xs">{summary}</span>}
                <TooltipIconButton tooltip="Copy tree" onClick={onCopy} disabled={!treeOutput}>
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
                </TooltipIconButton>
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

          {/* Approval buttons if needed */}
          <ToolApprovalButtons
            toolCalled={toolCalled}
            toolCallId={toolCallId}
            toolApprovalMetadata={toolApprovalMetadata}
            toolName={toolName}
            isNetwork={isNetwork}
          />
        </div>
      )}
    </div>
  );
};
