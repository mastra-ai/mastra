'use client';

import { useMemo } from 'react';
import { FileDiff } from '@pierre/diffs/react';
import { parseDiffFromFile } from '@pierre/diffs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ds/components/Dialog';
import type { FileContents } from '@pierre/diffs';

import type { TxtDiffModalProps } from './types';

/**
 * Modal component that displays a text diff for instructions.
 * All diff computation happens client-side.
 */
export function TxtDiffModal({ open, onOpenChange, revisionId, previousText, currentText }: TxtDiffModalProps) {
  const fileDiff = useMemo(() => {
    const oldFile: FileContents = {
      name: 'revision',
      contents: previousText,
      lang: 'markdown',
    };
    const newFile: FileContents = {
      name: 'current',
      contents: currentText,
      lang: 'markdown',
    };
    return parseDiffFromFile(oldFile, newFile);
  }, [previousText, currentText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] w-[90vw] h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Instruction Diff: {revisionId}</DialogTitle>
          <DialogDescription>Comparing revision instructions with current form</DialogDescription>
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
