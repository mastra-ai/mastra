'use client';

import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
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
    <Field invalid={Boolean(error)} className="flex flex-col gap-3">
      <FieldLabel className="sr-only">CSV file</FieldLabel>
      <Input
        ref={inputRef}
        name="csv-file"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        disabled={isParsing}
      />

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
            <span className="text-body text-muted-foreground">Parsing CSV...</span>
          </>
        ) : (
          <>
            <Icon className="text-muted-foreground">
              <Upload className="h-8 w-8" />
            </Icon>
            <div className="flex flex-col items-center gap-1">
              <span className="text-subheading text-placeholder">Click to upload or drag and drop</span>
              <span className="text-caption text-muted-foreground">CSV files only</span>
            </div>
          </>
        )}
      </div>

      <FieldError>{error}</FieldError>
    </Field>
  );
}
