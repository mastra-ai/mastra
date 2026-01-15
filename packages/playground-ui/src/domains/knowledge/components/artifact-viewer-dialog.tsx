import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Skeleton } from '@/ds/components/Skeleton';
import { Copy, X, FileText, Check } from 'lucide-react';
import { useState } from 'react';

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

  const isStatic = artifactKey.startsWith('static/');
  const displayKey = isStatic ? artifactKey.slice(7) : artifactKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b border-border1">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-icon4" />
            <span className="font-mono truncate">{displayKey}</span>
            {isStatic && (
              <span className="px-1.5 py-0.5 rounded text-[0.625rem] bg-amber-500/10 text-amber-400">static</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              {/* Content Section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-icon3 uppercase tracking-wide">Content</span>
                  <Button variant="light" size="md" onClick={handleCopy} className="h-7">
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-green-400" />
                        <span className="text-green-400 text-xs">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        <span className="text-xs">Copy</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-surface4 text-sm font-mono text-icon5 whitespace-pre-wrap overflow-auto max-h-[300px]">
                  {content || 'No content'}
                </pre>
              </div>

              {/* Metadata Section */}
              {metadata && Object.keys(metadata).length > 0 && (
                <div className="px-4 pb-4">
                  <span className="text-xs text-icon3 uppercase tracking-wide block mb-2">Metadata</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(metadata).map(([key, value]) => (
                      <div key={key} className="p-2 rounded bg-surface4">
                        <div className="text-[0.625rem] text-icon3 uppercase">{key}</div>
                        <div className="text-sm font-mono text-icon5 truncate">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border1 flex justify-end">
          <Button variant="light" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
