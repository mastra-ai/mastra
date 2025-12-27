import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, X, FileText, Check, Code, Tag } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/ds/components/Badge';

interface ArtifactViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifactKey: string;
  content?: string;
  metadata?: Record<string, unknown>;
  isLoading?: boolean;
}

export function ArtifactViewerDialog({
  open,
  onOpenChange,
  artifactKey,
  content,
  metadata,
  isLoading,
}: ArtifactViewerDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contentLength = content?.length ?? 0;
  const lineCount = content?.split('\n').length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 p-4 border-b border-border1 bg-surface2/50">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-500/10">
              <FileText className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="truncate block font-mono text-sm">{artifactKey}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <>
              {/* Content Section */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-surface2/30 border-b border-border1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-text3">
                      <Code className="h-3 w-3" />
                      <span>Content</span>
                    </div>
                    <span className="text-xs text-text3">
                      {contentLength.toLocaleString()} chars &middot; {lineCount} lines
                    </span>
                  </div>
                  <Button variant="light" size="md" onClick={handleCopy} className="h-7">
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1.5 text-green-400" />
                        <span className="text-green-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-text2">
                    {content || 'No content available'}
                  </pre>
                </div>
              </div>

              {/* Metadata Section */}
              {metadata && Object.keys(metadata).length > 0 && (
                <div className="flex-shrink-0 border-t border-border1">
                  <div className="flex items-center gap-1.5 px-4 py-2 bg-surface2/30 border-b border-border1">
                    <Tag className="h-3 w-3 text-text3" />
                    <span className="text-xs text-text3">Metadata</span>
                    <Badge variant="default" className="text-xs ml-2 bg-surface3">
                      {Object.keys(metadata).length} fields
                    </Badge>
                  </div>
                  <div className="p-4 max-h-[200px] overflow-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(metadata).map(([key, value]) => (
                        <div key={key} className="p-2 rounded-md bg-surface2">
                          <div className="text-xs text-text3 mb-0.5">{key}</div>
                          <div className="text-sm font-mono text-text2 truncate">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border1 bg-surface2/30 flex-shrink-0">
          <Button variant="light" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1.5" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
