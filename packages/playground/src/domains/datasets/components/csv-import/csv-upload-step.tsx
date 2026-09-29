'use client';

import { FieldBlock, fieldErrorId } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

export interface CSVUploadStepProps {
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  error?: string | null;
}

/**
 * File upload dropzone for CSV import.
 * Supports click-to-upload and drag-drop.
 */
export function CSVUploadStep({ onFileSelect, isParsing, error }: CSVUploadStepProps) {
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
      if (file && file.name.endsWith('.csv')) {
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
        id="input-csv-file"
        name="csv-file"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        disabled={isParsing}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? fieldErrorId('csv-file') : undefined}
      />

      {/* Dropzone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3',
          'min-h-[160px] rounded-lg border-2 border-dashed p-4',
          'cursor-pointer transition-colors',
          // Default state
          'border-border bg-background',
          // Drag over state
          isDragOver && 'border-success-edge bg-success-subtle',
          // Error state
          error && 'border-destructive-edge bg-destructive-subtle',
          // Disabled during parsing
          isParsing && 'cursor-wait opacity-60',
        )}
      >
        {isParsing ? (
          <>
            <Spinner />
            <Txt as="span" tone="muted">
              Parsing CSV...
            </Txt>
          </>
        ) : (
          <>
            <Icon className="text-muted-foreground">
              <Upload className="h-8 w-8" />
            </Icon>
            <div className="flex flex-col items-center gap-1">
              <Txt as="span" variant="subheading" tone="faint">
                Click to upload or drag and drop
              </Txt>
              <Txt as="span" variant="caption" tone="muted">
                CSV files only
              </Txt>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && <FieldBlock.ErrorMsg name="csv-file">{error}</FieldBlock.ErrorMsg>}
    </div>
  );
}
