'use client';

import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/ds/components/Button';

interface JsonDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  previousValue: unknown;
  currentValue: unknown;
}

/**
 * Encodes a value as a JSON string for the diffs.com URL.
 */
function encodeJsonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Modal component that displays a JSON diff using diffs.com in an iframe.
 * Uses the diffs.com URL format: https://diffs.com/?left=<encoded>&right=<encoded>
 */
export function JsonDiffModal({ open, onOpenChange, fieldName, previousValue, currentValue }: JsonDiffModalProps) {
  const diffUrl = useMemo(() => {
    const leftContent = encodeJsonValue(previousValue);
    const rightContent = encodeJsonValue(currentValue);

    // diffs.com accepts left and right parameters with base64 encoded content
    const leftEncoded = btoa(unescape(encodeURIComponent(leftContent)));
    const rightEncoded = btoa(unescape(encodeURIComponent(rightContent)));

    return `https://diffs.com/?left=${leftEncoded}&right=${rightEncoded}`;
  }, [previousValue, currentValue]);

  const handleOpenExternal = () => {
    window.open(diffUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] w-[90vw] h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>JSON Diff: {fieldName}</DialogTitle>
              <DialogDescription>Comparing previous and current values</DialogDescription>
            </div>
            <Button variant="ghost" size="md" onClick={handleOpenExternal} title="Open in new tab">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in new tab
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md overflow-hidden border border-border1 bg-white">
          <iframe
            src={diffUrl}
            title={`JSON Diff for ${fieldName}`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
