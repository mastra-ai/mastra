import { Button } from '@mastra/playground-ui/components/Button';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { FileText, X, Copy, Check } from 'lucide-react';

export interface ReferenceViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  referencePath: string;
  content?: string;
  isLoading: boolean;
  error?: string;
}

export function ReferenceViewerDialog({
  open,
  onOpenChange,
  skillName,
  referencePath,
  content,
  isLoading,
  error,
}: ReferenceViewerDialogProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 2000, showToast: false });

  if (!open) return null;

  const handleCopy = () => {
    if (!content) return;
    copyToClipboard(content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      {/* Dialog */}
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-viewer-title"
        onKeyDown={e => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded bg-muted p-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 id="reference-viewer-title" className="text-subheading text-foreground">
                {referencePath}
              </h2>
              <p className="text-caption text-muted-foreground">from {skillName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="md" variant="default" onClick={handleCopy} disabled={!content || isLoading}>
              <Icon>
                {isCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Icon>
              {isCopied ? 'Copied!' : 'Copy'}
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close reference viewer"
              className={cn('rounded-lg p-2 hover:bg-fill-subtle', quietTextHover, controlStateColorTransition)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent1 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-2 text-red-400">Failed to load reference</p>
              <p className="text-body text-muted-foreground">{error}</p>
            </div>
          ) : content ? (
            <pre className="overflow-auto rounded-lg bg-card p-4 text-body whitespace-pre-wrap text-foreground">
              {content}
            </pre>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">No content available</div>
          )}
        </div>
      </div>
    </div>
  );
}
