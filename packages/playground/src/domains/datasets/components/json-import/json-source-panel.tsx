import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { FileDropBackdrop } from '@mastra/playground-ui/components/FileDropBackdrop';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FileJson, Upload, RefreshCw } from 'lucide-react';
import { useRef } from 'react';

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
        <CodeEditor
          aria-label="JSON items"
          language="json"
          lineNumbers={false}
          showCopyButton={false}
          placeholder={PASTE_PLACEHOLDER}
          value={pastedText}
          onChange={onPastedTextChange}
          editable={!isImporting}
          className="min-h-50 flex-1"
        />
      </TabContent>
    </Tabs>
  );
}

/** Picks a JSON file from the file picker, or from a file dropped anywhere on the window. */
function Dropzone({ onFileSelect, disabled }: { onFileSelect: (file: File) => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFileSelect(selected);
    // Reset so the same file can be picked again.
    e.target.value = '';
  };

  return (
    <FileDropBackdrop
      disabled={disabled}
      accept=".json,application/json"
      label="Drop JSON to import"
      description="The file opens in the JSON import"
      onFilesDrop={([dropped]) => onFileSelect(dropped)}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        aria-label="Choose a JSON file"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      <EmptyState
        iconSlot={<FileJson />}
        titleSlot="Drop a JSON file anywhere on this window"
        descriptionSlot={`Or choose one from your computer. An array of items, up to ${MAX_IMPORT_LABEL}.`}
        actionSlot={
          <Button onClick={() => inputRef.current?.click()} disabled={disabled}>
            <Upload />
            Choose a file
          </Button>
        }
      />
    </FileDropBackdrop>
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
    <div data-testid="json-file-card" className="rounded-lg border border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <FileJson className="size-4 shrink-0 text-muted-foreground" />
        <Txt as="span" variant="caption" tone="ink" font="mono" className="min-w-0 flex-1 truncate">
          {file.name}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="shrink-0">
          {formatFileSize(file.size)}
        </Txt>
        <Button icon={<RefreshCw />} variant="ghost" size="sm" onClick={onReplace} disabled={isImporting}>
          Replace
        </Button>
      </div>

      {visibleRows.map(row => (
        <div
          key={row.index}
          className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-t border-border px-3 py-1.5"
        >
          <Txt as="span" variant="meta" tone="muted">
            {row.index}
          </Txt>
          <Txt as="span" variant="caption" tone="ink" font="mono" className="truncate">
            {formatInput(row.input)}
          </Txt>
          {!row.hasInput ? (
            <Badge variant="destructive" size="xs">
              no input
            </Badge>
          ) : !row.hasGroundTruth ? (
            <Badge variant="warning" size="xs">
              no groundTruth
            </Badge>
          ) : null}
        </div>
      ))}

      {total > PREVIEW_ROW_COUNT && (
        <Txt as="p" variant="meta" tone="muted" className="border-t border-border px-3 py-1.5">
          + {total - PREVIEW_ROW_COUNT} more
        </Txt>
      )}
    </div>
  );
}
