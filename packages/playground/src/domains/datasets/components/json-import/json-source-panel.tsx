import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { FileJson, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';

import { MAX_IMPORT_LABEL } from '../../utils/json-validation';
import type { JSONImportValidation, JSONPreviewRow } from '../../utils/json-validation';

export type JSONSourceTab = 'upload' | 'paste';

export interface JSONSourceFile {
  name: string;
  size: number;
}

export interface JSONSourcePanelProps {
  tab: JSONSourceTab;
  onTabChange: (tab: JSONSourceTab) => void;
  file: JSONSourceFile | null;
  onFileSelect: (file: File) => void;
  onReplace: () => void;
  pastedText: string;
  onPastedTextChange: (text: string) => void;
  validation: JSONImportValidation;
  isImporting: boolean;
}

const PREVIEW_ROW_COUNT = 10;
const PASTE_PLACEHOLDER = `[
  { "input": "…", "groundTruth": "…" }
]`;

const tabContentClassName = 'flex min-h-0 flex-1 flex-col py-0';

export function JSONSourcePanel({
  tab,
  onTabChange,
  file,
  onFileSelect,
  onReplace,
  pastedText,
  onPastedTextChange,
  validation,
  isImporting,
}: JSONSourcePanelProps) {
  return (
    <Tabs value={tab} defaultTab="upload" onValueChange={onTabChange} className="flex h-full flex-col gap-3">
      <TabList variant="pill">
        <Tab value="upload">Upload file</Tab>
        <Tab value="paste">Paste JSON</Tab>
      </TabList>

      <TabContent value="upload" className={tabContentClassName}>
        {file ? (
          <FileCard file={file} validation={validation} onReplace={onReplace} isImporting={isImporting} />
        ) : (
          <Dropzone onFileSelect={onFileSelect} disabled={isImporting} />
        )}
      </TabContent>

      <TabContent value="paste" className={tabContentClassName}>
        <Textarea
          aria-label="JSON items"
          className="text-ui-sm min-h-[200px] flex-1 resize-none font-mono"
          placeholder={PASTE_PLACEHOLDER}
          spellCheck={false}
          value={pastedText}
          onChange={e => onPastedTextChange(e.target.value)}
          disabled={isImporting}
        />
      </TabContent>
    </Tabs>
  );
}

function Dropzone({ onFileSelect, disabled }: { onFileSelect: (file: File) => void; disabled: boolean }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        onFileSelect(selected);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;

      const dropped = e.dataTransfer.files?.[0];
      if (dropped) {
        onFileSelect(dropped);
      }
    },
    [disabled, onFileSelect],
  );

  return (
    <div
      data-testid="json-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'border-border1 bg-surface3 relative flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
        'hover:border-accent1/50 hover:bg-accent1/5',
        isDragOver && 'border-accent1/50 bg-accent1/5',
        disabled && 'cursor-wait opacity-60',
      )}
    >
      <input
        type="file"
        accept=".json,application/json"
        aria-label="Choose a JSON file"
        onChange={handleFileChange}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      <div className="border-border1 bg-surface2 text-neutral4 flex size-9 items-center justify-center rounded-md border">
        <Upload className="size-4" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-ui-md text-neutral6">Drop a JSON file here</p>
        <p className="text-ui-sm text-neutral4">
          or <span className="underline">choose a file</span> from your computer
        </p>
      </div>
      <p className="text-ui-xs text-neutral3">.json · an array of items · up to {MAX_IMPORT_LABEL}</p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatInput(input: unknown) {
  return typeof input === 'string' ? input : (JSON.stringify(input) ?? '');
}

function FileCard({
  file,
  validation,
  onReplace,
  isImporting,
}: {
  file: JSONSourceFile;
  validation: JSONImportValidation;
  onReplace: () => void;
  isImporting: boolean;
}) {
  const rows: JSONPreviewRow[] = 'rows' in validation ? validation.rows : [];
  const total = 'total' in validation ? validation.total : 0;
  const visibleRows = rows.slice(0, PREVIEW_ROW_COUNT);

  return (
    <div data-testid="json-file-card" className="border-border1 rounded-lg border">
      <div className="flex items-center gap-2 px-3 py-2">
        <FileJson className="text-neutral4 size-4 shrink-0" />
        <span className="text-ui-sm text-neutral6 min-w-0 flex-1 truncate font-mono">{file.name}</span>
        <span className="text-ui-xs text-neutral3 shrink-0">{formatFileSize(file.size)}</span>
        <Button variant="ghost" size="xs" onClick={onReplace} disabled={isImporting}>
          Replace
        </Button>
      </div>

      {visibleRows.map(row => (
        <div
          key={row.index}
          className="border-border1 grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-t px-3 py-1.5"
        >
          <span className="text-ui-xs text-neutral3">{row.index}</span>
          <span className="text-ui-sm text-neutral5 truncate font-mono">{formatInput(row.input)}</span>
          {!row.hasInput ? (
            <Badge variant="red" size="xs">
              no input
            </Badge>
          ) : !row.hasGroundTruth ? (
            <Badge variant="yellow" size="xs">
              no groundTruth
            </Badge>
          ) : null}
        </div>
      ))}

      {total > PREVIEW_ROW_COUNT && (
        <div className="border-border1 text-ui-xs text-neutral3 border-t px-3 py-1.5">
          + {total - PREVIEW_ROW_COUNT} more
        </div>
      )}
    </div>
  );
}
