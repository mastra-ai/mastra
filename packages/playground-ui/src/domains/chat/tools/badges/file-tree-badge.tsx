import { HardDrive } from 'lucide-react';
import type { DataMessagePart } from '../tool-card';
import { parseToolArgs, workspaceMetadata } from './workspace-data-parts';
import { WorkspaceLink } from './workspace-link';
import type { MessageMetadata } from '@/domains/chat';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalButtonsProps } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { ActivityHeadline } from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { presentTool, ToolCallArguments, ToolCallOutput } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';

export interface FileTreeBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: unknown;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
  status?: ActivityStatus;
}

function listingOptions(args: Record<string, unknown>): string[] {
  const options: string[] = [];
  if (typeof args.maxDepth === 'number') options.push(`depth: ${args.maxDepth}`);
  if (args.showHidden === true) options.push('hidden');
  if (args.dirsOnly === true) options.push('dirs only');
  if (typeof args.exclude === 'string' && args.exclude) options.push(`exclude: ${args.exclude}`);
  if (typeof args.extension === 'string' && args.extension) options.push(`ext: ${args.extension}`);
  return options;
}

function splitTreeResult(result: unknown): { tree: string; summary: string } {
  if (typeof result !== 'string') return { tree: '', summary: '' };
  const summaryStart = result.lastIndexOf('\n\n');
  if (summaryStart === -1) return { tree: result, summary: '' };
  return { tree: result.slice(0, summaryStart), summary: result.slice(summaryStart + 2) };
}

export const FileTreeBadge = ({
  toolName,
  args,
  result,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  isNetwork,
  toolCalled: toolCalledProp,
  dataParts,
  status = 'idle',
}: FileTreeBadgeProps) => {
  const parsedArgs = parseToolArgs(args);
  const path = typeof parsedArgs.path === 'string' && parsedArgs.path ? parsedArgs.path : '.';
  const { icon: ToolIcon, label, detail = path } = presentTool(toolName, parsedArgs);
  const options = listingOptions(parsedArgs);
  const { tree, summary } = splitTreeResult(result);
  const toolCalled = toolCalledProp ?? Boolean(tree);
  const workspace = workspaceMetadata(dataParts, toolCallId);
  const needsApproval = awaitsToolApproval({ toolApprovalMetadata, toolCalled });
  const hasBody = Boolean(tree) || needsApproval;

  return (
    <ToolApprovalBadge
      approval={{
        toolCalled,
        toolCallId,
        toolApprovalMetadata,
        toolName,
        isNetwork,
        isGenerateMode: metadata?.mode === 'generate',
      }}
      data-testid="file-tree-badge"
      header={badges => (
        <ActivityHeadline
          badges={badges}
          icon={<ToolIcon aria-hidden />}
          label={label}
          detail={options.length > 0 ? `${detail} (${options.join(', ')})` : detail}
        />
      )}
      status={status}
      extraInfo={
        (summary || workspace?.filesystem) && (
          <>
            {summary && (
              <Txt as="span" variant="meta" tone="muted" className="truncate">
                {summary}
              </Txt>
            )}
            {workspace?.filesystem && (
              <WorkspaceLink
                href={workspace.id ? `/workspaces/${workspace.id}?path=${encodeURIComponent(path)}` : '/workspaces'}
                icon={<HardDrive className="size-3 shrink-0" aria-hidden />}
              >
                {workspace.name || workspace.filesystem.name}
              </WorkspaceLink>
            )}
          </>
        )
      }
      initialCollapsed={!toolApprovalMetadata}
    >
      {hasBody && (
        <>
          {needsApproval && <ToolCallArguments toolName={toolName} args={parsedArgs} data-testid="tool-args" />}
          {tree && <ToolCallOutput text={tree} />}
        </>
      )}
    </ToolApprovalBadge>
  );
};
