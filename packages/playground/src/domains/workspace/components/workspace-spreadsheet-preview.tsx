import { Button, Spinner } from '@mastra/playground-ui';
import { useEffect, useMemo, useState } from 'react';
import { WorkspaceDataListPreview } from './workspace-data-list-preview';
import { base64ToUint8Array } from './workspace-preview-binary-utils';
import { WorkspacePreviewFallback } from './workspace-preview-fallback';
import { cn } from '@/lib/utils';

interface SpreadsheetSheet {
  name: string;
  rows: string[][];
}

interface SpreadsheetPreviewState {
  error: Error | null;
  isLoading: boolean;
  sheets: SpreadsheetSheet[];
}

export interface WorkspaceSpreadsheetPreviewProps {
  content: string;
  isDownloading?: boolean;
  onDownload?: () => void;
  workspaceHref?: string;
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeSheetRows(rows: unknown[][]) {
  return rows.map(row => row.map(normalizeCellValue));
}

export function WorkspaceSpreadsheetPreview({
  content,
  isDownloading,
  onDownload,
  workspaceHref,
}: WorkspaceSpreadsheetPreviewProps) {
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [state, setState] = useState<SpreadsheetPreviewState>({
    error: null,
    isLoading: true,
    sheets: [],
  });

  useEffect(() => {
    let isCancelled = false;

    const loadSpreadsheet = async () => {
      try {
        setState({ error: null, isLoading: true, sheets: [] });

        const xlsx = await import('xlsx');
        const workbook = xlsx.read(base64ToUint8Array(content), { type: 'array' });
        const sheets = workbook.SheetNames.map(name => {
          const worksheet = workbook.Sheets[name];
          const rows = worksheet
            ? xlsx.utils.sheet_to_json<unknown[]>(worksheet, { blankrows: false, defval: '', header: 1, raw: false })
            : [];

          return {
            name,
            rows: normalizeSheetRows(rows),
          };
        });

        if (!isCancelled) {
          setActiveSheetName(sheets[0]?.name ?? null);
          setState({ error: null, isLoading: false, sheets });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({
            error: error instanceof Error ? error : new Error('Failed to parse spreadsheet'),
            isLoading: false,
            sheets: [],
          });
        }
      }
    };

    void loadSpreadsheet();

    return () => {
      isCancelled = true;
    };
  }, [content]);

  const activeSheet = useMemo(
    () => state.sheets.find(sheet => sheet.name === activeSheetName) ?? state.sheets[0],
    [activeSheetName, state.sheets],
  );

  if (state.isLoading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state.error) {
    return (
      <WorkspacePreviewFallback
        isDownloading={isDownloading}
        message={state.error.message}
        onDownload={onDownload}
        title="Failed to preview spreadsheet"
        workspaceHref={workspaceHref}
      />
    );
  }

  if (!activeSheet) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center">
        <p className="text-sm font-medium text-neutral6">No sheets to preview</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      {state.sheets.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-border1 px-3 py-2">
          {state.sheets.map(sheet => (
            <Button
              key={sheet.name}
              type="button"
              variant={sheet.name === activeSheet.name ? 'default' : 'ghost'}
              size="xs"
              className={cn('shrink-0', sheet.name === activeSheet.name && 'bg-surface4')}
              onClick={() => setActiveSheetName(sheet.name)}
            >
              {sheet.name}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <WorkspaceDataListPreview caption={activeSheet.name} headerMode="letters" rows={activeSheet.rows} />
      </div>
    </div>
  );
}
