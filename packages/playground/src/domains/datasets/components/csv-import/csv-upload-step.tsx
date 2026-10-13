import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { FileDropBackdrop } from '@mastra/playground-ui/components/FileDropBackdrop';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef } from 'react';

export interface CSVUploadStepProps {
  onFileSelect: (file: File) => void;
  isParsing: boolean;
  error?: string | null;
}

/** Picks a CSV from the file picker, or from a file dropped anywhere on the window. */
export function CSVUploadStep({ onFileSelect, isParsing, error }: CSVUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset so the same file can be picked again.
    e.target.value = '';
  };

  return (
    <FileDropBackdrop
      disabled={isParsing}
      accept=".csv,text/csv"
      label="Drop CSV to import"
      description="The file opens in the CSV import"
      onFilesDrop={([file]) => onFileSelect(file)}
    >
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
        {isParsing ? (
          <EmptyState iconSlot={<Spinner />} titleSlot="Parsing CSV..." />
        ) : (
          <EmptyState
            iconSlot={<FileSpreadsheet />}
            titleSlot="Drop a CSV file anywhere on this window"
            descriptionSlot="Or choose one from your computer."
            actionSlot={
              <Button onClick={() => inputRef.current?.click()}>
                <Upload />
                Choose a file
              </Button>
            }
          />
        )}
        <FieldError>{error}</FieldError>
      </Field>
    </FileDropBackdrop>
  );
}
