import { FileText, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';

export interface ReferenceViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  referencePath: string;
  content: string | null;
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
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      {/* Dialog */}
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-surface2 rounded-xl border border-border1 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border1 bg-surface3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-surface5">
              <FileText className="h-4 w-4 text-icon4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-icon6">{referencePath}</h2>
              <p className="text-xs text-icon3">from {skillName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="md" variant="light" onClick={handleCopy} disabled={!content || isLoading}>
              <Icon>
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Icon>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-surface4 text-icon3 hover:text-icon5 transition-colors"
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
              <p className="text-sm text-icon3">{error}</p>
            </div>
          ) : content ? (
            <pre className="whitespace-pre-wrap text-sm text-icon5 font-mono bg-surface3 p-4 rounded-lg overflow-auto">
              {content}
            </pre>
          ) : (
            <div className="flex items-center justify-center py-12 text-icon3">No content available</div>
          )}
        </div>
      </div>
    </div>
  );
}
