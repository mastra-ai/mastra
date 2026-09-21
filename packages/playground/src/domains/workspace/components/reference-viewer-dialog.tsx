import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Button } from '@mastra/playground-ui/components/Button';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
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
        className="bg-card shadow-raised relative mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-viewer-title"
        onKeyDown={e => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
      >
        {/* Header */}
        <div className="border-border1 bg-surface3 flex items-center justify-between border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-surface5 rounded p-1.5">
              <FileText className="text-muted-foreground h-4 w-4" />
            </div>
            <div>
              <h2 id="reference-viewer-title" className="text-foreground text-subheading">
                {referencePath}
              </h2>
              <p className="text-muted-foreground text-caption">from {skillName}</p>
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
              className={cn('hover:bg-surface4 rounded-lg p-2', quietTextHover, controlStateColorTransition)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-accent1 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-2 text-red-400">Failed to load reference</p>
              <p className="text-muted-foreground text-body">{error}</p>
            </div>
          ) : content ? (
            <pre className="text-foreground bg-surface3 text-body overflow-auto rounded-lg p-4 font-mono whitespace-pre-wrap">
              {content}
            </pre>
          ) : (
            <div className="text-muted-foreground flex items-center justify-center py-8">No content available</div>
          )}
        </div>
      </div>
    </div>
  );
}
