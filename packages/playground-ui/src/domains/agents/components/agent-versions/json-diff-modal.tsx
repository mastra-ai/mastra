'use client';

import { useMemo } from 'react';
import { FileDiff } from '@pierre/diffs/react';
import { parseDiffFromFile } from '@pierre/diffs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { FileContents } from '@pierre/diffs';

interface JsonDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  previousValue: unknown;
  currentValue: unknown;
}

/**
 * Formats a value as a JSON string for display.
 */
function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Modal component that displays a JSON diff using @pierre/diffs locally.
 * All diff computation happens client-side - no data is sent to external services.
 */
export function JsonDiffModal({ open, onOpenChange, fieldName, previousValue, currentValue }: JsonDiffModalProps) {
  const fileDiff = useMemo(() => {
    const filename = `${fieldName}.json`;
    const oldFile: FileContents = {
      name: filename,
      contents: formatJsonValue(previousValue),
      lang: 'json',
    };
    const newFile: FileContents = {
      name: filename,
      contents: formatJsonValue(currentValue),
      lang: 'json',
    };
    return parseDiffFromFile(oldFile, newFile);
  }, [previousValue, currentValue, fieldName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] w-[90vw] h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>JSON Diff: {fieldName}</DialogTitle>
          <DialogDescription>Comparing previous and current values</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md overflow-auto border border-border1 bg-surface2">
          <FileDiff
            fileDiff={fileDiff}
            options={{
              theme: 'pierre-dark',
              lineDiffType: 'word',
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
