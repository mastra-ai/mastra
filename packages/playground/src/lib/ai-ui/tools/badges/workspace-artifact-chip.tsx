import { Button } from '@mastra/playground-ui';
import { FileText } from 'lucide-react';
import { useMemo } from 'react';
import { useArtifactPreview } from '../../artifacts/artifact-preview-context';
import type { WorkspaceArtifactRef } from '../../artifacts/artifact-preview-context';

interface DataMessagePart {
  type: string;
  name?: string;
  data?: unknown;
}

interface WorkspaceArtifactChipProps {
  args: unknown;
  dataParts?: ReadonlyArray<DataMessagePart>;
  result: unknown;
  toolCallId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseArgs(args: unknown): Record<string, unknown> | null {
  if (isRecord(args)) return args;

  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function getStringProperty(record: Record<string, unknown> | null | undefined, property: string) {
  const value = record?.[property];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getFileName(path: string) {
  return path.split('/').filter(Boolean).pop() || path;
}

function getWorkspaceMetadata(dataParts: ReadonlyArray<DataMessagePart> | undefined, toolCallId: string) {
  const part = (dataParts ?? []).find(messagePart => {
    const isWorkspaceMetadata =
      (messagePart.type === 'data' && messagePart.name === 'workspace-metadata') ||
      messagePart.type === 'data-workspace-metadata';

    if (!isWorkspaceMetadata || !isRecord(messagePart.data)) {
      return false;
    }

    return messagePart.data.toolCallId === toolCallId;
  });

  return isRecord(part?.data) ? part.data : undefined;
}

function getArtifact({ args, dataParts, result, toolCallId }: WorkspaceArtifactChipProps): WorkspaceArtifactRef | null {
  if (result === undefined) return null;

  const parsedArgs = parseArgs(args);
  const path = getStringProperty(parsedArgs, 'path');
  const workspaceMetadata = getWorkspaceMetadata(dataParts, toolCallId);
  const workspaceId = getStringProperty(workspaceMetadata, 'id');

  if (!path || !workspaceId) return null;

  const resultRecord = isRecord(result) ? result : null;

  return {
    workspaceId,
    workspaceName: getStringProperty(workspaceMetadata, 'name'),
    path,
    name: getFileName(path),
    mimeType: getStringProperty(resultRecord, 'mimeType') ?? getStringProperty(parsedArgs, 'mimeType'),
    sourceToolCallId: toolCallId,
  };
}

export function WorkspaceArtifactChip({ args, dataParts, result, toolCallId }: WorkspaceArtifactChipProps) {
  const { openArtifact } = useArtifactPreview();
  const artifact = useMemo(
    () => getArtifact({ args, dataParts, result, toolCallId }),
    [args, dataParts, result, toolCallId],
  );

  if (!artifact) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="max-w-full"
      onClick={() => openArtifact(artifact)}
      data-testid="workspace-artifact-chip"
    >
      <FileText />
      <span>Open file</span>
      <span className="truncate text-neutral4">{artifact.name}</span>
    </Button>
  );
}
