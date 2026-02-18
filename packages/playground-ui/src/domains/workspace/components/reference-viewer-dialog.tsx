import { FileText, X, Copy, Check } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/lib/ai-ui/hooks/use-copy-to-clipboard';

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
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 2000 });

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
        className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-surface2 rounded-xl border border-border1 shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-viewer-title"
        onKeyDown={e => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border1 bg-surface3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-surface5">
              <FileText className="h-4 w-4 text-neutral4" />
            </div>
            <div>
              <h2 id="reference-viewer-title" className="text-base font-medium text-neutral6">
                {referencePath}
              </h2>
              <p className="text-xs text-neutral3">from {skillName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="md" variant="light" onClick={handleCopy} disabled={!content || isLoading}>
              <Icon>
                {isCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Icon>
              {isCopied ? 'Copied!' : 'Copy'}
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close reference viewer"
              className="p-2 rounded-lg hover:bg-surface4 text-neutral3 hover:text-neutral5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-accent1 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-red-400 mb-2">Failed to load reference</p>
              <p className="text-sm text-neutral3">{error}</p>
            </div>
          ) : content ? (
            <pre className="whitespace-pre-wrap text-sm text-neutral5 font-mono bg-surface3 p-4 rounded-lg overflow-auto">
              {content}
            </pre>
          ) : (
            <div className="flex items-center justify-center py-12 text-neutral3">No content available</div>
          )}
        </div>
      </div>
    </div>
  );
}
