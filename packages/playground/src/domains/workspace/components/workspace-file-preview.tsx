import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  File,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Image,
  Presentation,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { isWorkspaceFilesystemUnavailableError } from '../compatibility';
import { useWorkspaceFile, useWorkspaceFileStat, useWorkspaces } from '../hooks/use-workspace';
import { WorkspaceDelimitedDataListPreview } from './workspace-data-list-preview';
import { WorkspaceDocumentPreview } from './workspace-document-preview';
import {
  formatWorkspaceFileSize,
  getWorkspaceFileLanguageFromPath,
  getWorkspaceFileName,
  getWorkspaceFileParentPath,
  getWorkspaceFilePreviewKind,
  getWorkspaceFilePreviewSizeLimit,
  isWorkspaceFilePreviewBinary,
  isWorkspaceFilePreviewTooLarge,
} from './workspace-file-preview-utils';
import { WorkspacePdfPreview } from './workspace-pdf-preview';
import { WorkspacePresentationPreview } from './workspace-presentation-preview';
import { WorkspacePreviewFallback } from './workspace-preview-fallback';
import { WorkspaceSpreadsheetPreview } from './workspace-spreadsheet-preview';
import { WorkspaceTextPreview } from './workspace-text-preview';
import { cn } from '@/lib/utils';

export type WorkspaceFilePreviewVariant = 'artifact' | 'framed';

export interface WorkspaceFilePreviewProps {
  workspaceId: string;
  path: string;
  workspaceName?: string;
  onClose?: () => void;
  variant?: WorkspaceFilePreviewVariant;
}

export interface WorkspaceFilePreviewContentProps {
  path: string;
  content?: string;
  error?: Error | null;
  isLoading?: boolean;
  isDownloading?: boolean;
  mimeType?: string;
  size?: number;
  workspaceHref?: string;
  workspaceName?: string;
  onClose?: () => void;
  onDownload?: () => void;
  variant?: WorkspaceFilePreviewVariant;
}

function getFileIcon(path: string, mimeType?: string) {
  const ext = getWorkspaceFileName(path).split('.').pop()?.toLowerCase();
  const kind = getWorkspaceFilePreviewKind(path, mimeType);

  if (kind === 'image') return <Image className="h-4 w-4 text-purple-400" />;
  if (kind === 'spreadsheet' || kind === 'csv') return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
  if (kind === 'presentation') return <Presentation className="h-4 w-4 text-orange-400" />;
  if (kind === 'pdf' || ext === 'md' || ext === 'mdx') return <FileText className="h-4 w-4 text-neutral4" />;
  if (kind === 'document') return <FileText className="h-4 w-4 text-blue-400" />;
  if (ext === 'json') return <FileJson className="h-4 w-4 text-yellow-400" />;
  if (getWorkspaceFileLanguageFromPath(path)) return <FileCode className="h-4 w-4 text-blue-400" />;

  return <File className="h-4 w-4 text-neutral4" />;
}

function base64ToBlob(base64: string, mimeType: string) {
  const byteCharacters = window.atob(base64);
  const bytes = new Uint8Array(byteCharacters.length);

  for (let index = 0; index < byteCharacters.length; index += 1) {
    bytes[index] = byteCharacters.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function downloadBase64File(path: string, base64: string, mimeType = 'application/octet-stream') {
  const blob = base64ToBlob(base64, mimeType);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = getWorkspaceFileName(path);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getWorkspaceHref(workspaceId: string, path: string) {
  const params = new URLSearchParams({
    tab: 'files',
    path: getWorkspaceFileParentPath(path),
    file: path,
  });

  return `/workspaces/${workspaceId}?${params.toString()}`;
}

export function WorkspaceFilePreviewContent({
  path,
  content,
  error,
  isLoading,
  isDownloading,
  mimeType,
  size,
  workspaceHref,
  workspaceName,
  onClose,
  onDownload,
  variant = 'framed',
}: WorkspaceFilePreviewContentProps) {
  const fileName = getWorkspaceFileName(path);
  const previewKind = getWorkspaceFilePreviewKind(path, mimeType);
  const language = getWorkspaceFileLanguageFromPath(path);
  const sizeLabel = formatWorkspaceFileSize(size);
  const metadata = [mimeType, sizeLabel].filter(Boolean).join(' · ');
  const headerSubtitle = [workspaceName, path].filter(Boolean).join(' · ');
  const isArtifactVariant = variant === 'artifact';
  const previewSizeLimit = getWorkspaceFilePreviewSizeLimit(previewKind);
  const isPreviewTooLarge = isWorkspaceFilePreviewTooLarge(previewKind, size);
  const previewSizeLimitLabel = formatWorkspaceFileSize(previewSizeLimit ?? undefined);

  return (
    <div
      className={cn(
        'flex h-full min-h-[360px] flex-col overflow-hidden',
        isArtifactVariant ? 'bg-transparent' : 'rounded-lg border border-border1 bg-surface2',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          isArtifactVariant ? 'px-4 py-3' : 'border-b border-border1 bg-surface3 px-4 py-2',
        )}
      >
        <div className="min-w-0 flex items-center gap-2">
          {getFileIcon(path, mimeType)}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral6" title={fileName}>
              {fileName}
            </div>
            <div className="truncate text-xs text-neutral3" title={headerSubtitle}>
              {headerSubtitle}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {previewKind === 'text' && content ? (
            <CopyButton content={content} copyMessage="Copied file content" />
          ) : null}
          {workspaceHref ? (
            <Button as="a" href={workspaceHref} variant="ghost" size="icon-sm" tooltip="Open in workspace">
              <ExternalLink />
            </Button>
          ) : null}
          {onDownload ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              tooltip="Download file"
              disabled={isDownloading}
              onClick={onDownload}
            >
              <Download />
            </Button>
          ) : null}
          {onClose ? (
            <Button type="button" variant="ghost" size="icon-sm" tooltip="Close preview" onClick={onClose}>
              <X />
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-auto', isArtifactVariant ? 'bg-transparent' : 'bg-surface1')}>
        {isLoading ? (
          <div className="flex h-full min-h-[280px] items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
            <div>
              <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
              <p className="mb-1 text-sm font-medium text-neutral6">Failed to load file</p>
              <p className="text-xs text-neutral4">{error.message}</p>
            </div>
          </div>
        ) : isPreviewTooLarge ? (
          <WorkspacePreviewFallback
            isDownloading={isDownloading}
            message={`This file is ${sizeLabel || 'larger than expected'} and exceeds the ${previewSizeLimitLabel} inline preview limit.`}
            onDownload={onDownload}
            title="Preview skipped"
            workspaceHref={workspaceHref}
          />
        ) : previewKind === 'pdf' && content ? (
          <WorkspacePdfPreview content={content} fileName={fileName} />
        ) : previewKind === 'image' && content ? (
          <div className="flex h-full min-h-[320px] items-center justify-center p-4">
            <img
              src={`data:${mimeType || 'image/png'};base64,${content}`}
              alt={fileName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : previewKind === 'csv' && content !== undefined ? (
          <WorkspaceDelimitedDataListPreview
            content={content}
            fileName={fileName}
            type={fileName.toLowerCase().endsWith('.tsv') ? 'tsv' : 'csv'}
          />
        ) : previewKind === 'spreadsheet' && content ? (
          <WorkspaceSpreadsheetPreview
            content={content}
            isDownloading={isDownloading}
            onDownload={onDownload}
            workspaceHref={workspaceHref}
          />
        ) : previewKind === 'document' && content ? (
          <WorkspaceDocumentPreview
            content={content}
            isDownloading={isDownloading}
            onDownload={onDownload}
            workspaceHref={workspaceHref}
          />
        ) : previewKind === 'presentation' && content ? (
          <WorkspacePresentationPreview
            content={content}
            isDownloading={isDownloading}
            onDownload={onDownload}
            workspaceHref={workspaceHref}
          />
        ) : previewKind === 'text' && content !== undefined ? (
          <WorkspaceTextPreview content={content} language={language} mimeType={mimeType} path={path} />
        ) : (
          <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              {getFileIcon(path, mimeType)}
              <p className="mt-3 text-sm font-medium text-neutral6">Preview unavailable</p>
              <p className="mt-1 text-xs text-neutral4">{metadata || 'This file type is not previewable in Studio.'}</p>
              {workspaceHref || onDownload ? (
                <div className="mt-4 flex justify-center gap-2">
                  {workspaceHref ? (
                    <Button as="a" href={workspaceHref} variant="outline" size="sm">
                      <ExternalLink />
                      Open
                    </Button>
                  ) : null}
                  {onDownload ? (
                    <Button type="button" variant="outline" size="sm" disabled={isDownloading} onClick={onDownload}>
                      <Download />
                      Download
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceFilePreview({
  workspaceId,
  path,
  workspaceName,
  onClose,
  variant,
}: WorkspaceFilePreviewProps) {
  const client = useMastraClient();
  const [isDownloading, setIsDownloading] = useState(false);
  const {
    data: originalFileStat,
    error: originalStatError,
    isLoading: isLoadingOriginalStat,
  } = useWorkspaceFileStat(path, {
    enabled: !!workspaceId && !!path,
    workspaceId,
  });
  const shouldRecoverWorkspace = isWorkspaceFilesystemUnavailableError(originalStatError);
  const { data: workspacesData, isLoading: isLoadingWorkspaces } = useWorkspaces({
    enabled: shouldRecoverWorkspace,
  });
  const fallbackWorkspace = useMemo(() => {
    if (!shouldRecoverWorkspace) return null;

    const filesystemWorkspaces =
      workspacesData?.workspaces.filter(
        workspace => workspace.capabilities.hasFilesystem && workspace.id !== workspaceId,
      ) ?? [];

    return filesystemWorkspaces.length === 1 ? filesystemWorkspaces[0] : null;
  }, [shouldRecoverWorkspace, workspacesData?.workspaces, workspaceId]);
  const activeWorkspaceId = fallbackWorkspace?.id ?? workspaceId;
  const {
    data: fallbackFileStat,
    error: fallbackStatError,
    isLoading: isLoadingFallbackStat,
  } = useWorkspaceFileStat(path, {
    enabled: !!fallbackWorkspace && !!path,
    workspaceId: fallbackWorkspace?.id,
  });
  const fileStat = fallbackWorkspace ? fallbackFileStat : originalFileStat;
  const statError = fallbackWorkspace ? fallbackStatError : originalStatError;
  const isLoadingStat =
    isLoadingOriginalStat ||
    (shouldRecoverWorkspace && isLoadingWorkspaces) ||
    (!!fallbackWorkspace && isLoadingFallbackStat);
  const previewKind = useMemo(() => getWorkspaceFilePreviewKind(path, fileStat?.mimeType), [fileStat?.mimeType, path]);
  const encoding = isWorkspaceFilePreviewBinary(previewKind) ? 'base64' : 'utf-8';
  const shouldReadFile =
    previewKind !== 'unsupported' &&
    fileStat?.type === 'file' &&
    !isWorkspaceFilePreviewTooLarge(previewKind, fileStat.size);
  const {
    data: fileContent,
    error: fileError,
    isLoading: isLoadingFile,
  } = useWorkspaceFile(path, {
    enabled: shouldReadFile,
    encoding,
    workspaceId: activeWorkspaceId,
  });

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const workspace = (client as any).getWorkspace(activeWorkspaceId);
      const response = await workspace.readFile(path, 'base64');
      downloadBase64File(path, response.content, fileStat?.mimeType);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <WorkspaceFilePreviewContent
      path={path}
      content={fileContent?.content}
      error={(statError as Error | null) || (fileError as Error | null)}
      isLoading={isLoadingStat || (shouldReadFile && isLoadingFile)}
      isDownloading={isDownloading}
      mimeType={fileStat?.mimeType || fileContent?.mimeType}
      size={fileStat?.size ?? fileContent?.size}
      workspaceHref={getWorkspaceHref(activeWorkspaceId, path)}
      workspaceName={fallbackWorkspace?.name ?? workspaceName}
      onClose={onClose}
      onDownload={handleDownload}
      variant={variant}
    />
  );
}
