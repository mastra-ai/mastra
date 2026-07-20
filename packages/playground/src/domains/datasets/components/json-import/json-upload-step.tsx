'use client';

import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { FileJson } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

export interface JSONUploadStepProps {
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  error?: string | null;
}

/**
 * File upload dropzone for JSON import.
 * Supports click-to-upload and drag-drop.
 */
export function JSONUploadStep({ onFileSelect, isParsing, error }: JSONUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle click on dropzone
  const handleClick = useCallback(() => {
    if (!isParsing) {
      inputRef.current?.click();
    }
  }, [isParsing]);

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [onFileSelect],
  );

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isParsing) return;

      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith('.json')) {
        onFileSelect(file);
      }
    },
    [isParsing, onFileSelect],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        disabled={isParsing}
      />

      {/* Dropzone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3',
          'min-h-[160px] rounded-lg border-2 border-dashed p-6',
          'cursor-pointer transition-colors',
          // Default state
          'border-surface4 bg-surface2',
          // Drag over state
          isDragOver && 'border-accent1/50 bg-accent1/5',
          // Error state
          error && 'border-accent2/50 bg-accent2/5',
          // Disabled during parsing
          isParsing && 'cursor-wait opacity-60',
        )}
      >
        {isParsing ? (
          <>
            <Spinner />
            <span className="text-neutral4 text-sm">Parsing JSON...</span>
          </>
        ) : (
          <>
            <Icon className="text-neutral4">
              <FileJson className="h-8 w-8" />
            </Icon>
            <div className="flex flex-col items-center gap-1">
              <span className="text-neutral1 text-sm font-medium">Click to upload or drag and drop</span>
              <span className="text-neutral4 text-xs">JSON files only</span>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && <div className="text-accent2 text-sm">{error}</div>}

      {/* Format hint */}
      <div className="text-neutral4 bg-surface2 rounded-md p-3 text-xs">
        <p className="mb-1 font-medium">Expected format:</p>
        <pre className="overflow-x-auto text-[10px]">
          {`[
  {
    "input": "Your input data",
    "groundTruth": "Expected result (optional)",
    "metadata": { "key": "value" } // optional
  }
]`}
        </pre>
      </div>
    </div>
  );
}
