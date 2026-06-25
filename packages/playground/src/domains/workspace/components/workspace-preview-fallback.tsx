import { Button } from '@mastra/playground-ui/components/Button';
import { AlertCircle, Download, ExternalLink } from 'lucide-react';

export interface WorkspacePreviewFallbackProps {
  isDownloading?: boolean;
  message: string;
  onDownload?: () => void;
  title: string;
  workspaceHref?: string;
}

export function WorkspacePreviewFallback({
  isDownloading,
  message,
  onDownload,
  title,
  workspaceHref,
}: WorkspacePreviewFallbackProps) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
        <p className="mb-1 text-sm font-medium text-neutral6">{title}</p>
        <p className="text-xs text-neutral4">{message}</p>
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
  );
}
