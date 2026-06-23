import { useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import {
  collectEnvironmentVariables,
  createEmptyEnvironmentVariableEntry,
  getDuplicateEnvironmentVariableKeys,
  parseEnvFileText,
  readEnvFile,
} from '@/lib/env-file';
import type { EnvironmentVariableEntry } from '@/lib/env-file';

export type EnvironmentVariableRow = EnvironmentVariableEntry;

export interface UseEnvironmentVariablesEditorOptions<TRow extends EnvironmentVariableRow = EnvironmentVariableRow> {
  initialRows?: readonly TRow[];
  rows?: readonly TRow[];
  onRowsChange?: (rows: TRow[]) => void;
  createDefaultRow?: () => TRow;
  createRow?: (entry: EnvironmentVariableEntry) => TRow;
  getEditableRows?: (rows: readonly TRow[]) => readonly TRow[];
  getPreservedRows?: (rows: readonly TRow[]) => readonly TRow[];
  maxUploadSize?: number;
}

export interface EnvironmentVariablesEditorController<TRow extends EnvironmentVariableRow = EnvironmentVariableRow> {
  rows: readonly TRow[];
  uploadError: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  duplicateKeys: Set<string>;
  hasDuplicateKeys: boolean;
  isDirty: boolean;
  isRowsDirty: boolean;
  setRows: (rows: readonly TRow[]) => TRow[];
  resetRows: (rows?: readonly TRow[]) => TRow[];
  appendRow: (row?: TRow) => TRow[];
  updateRow: (index: number, patch: Partial<EnvironmentVariableEntry>) => TRow[];
  removeRow: (index: number) => TRow[];
  getRowsForSubmit: () => TRow[];
  getEnvironmentVariablesForSubmit: () => Record<string, string>;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePaste: (index: number, text: string) => boolean;
  clearUploadError: () => void;
  getRowId: (index: number) => string;
  isValueRevealed: (index: number) => boolean;
  toggleValueVisibility: (index: number) => void;
  rowHasDuplicateKey: (index: number) => boolean;
}

function defaultCreateRow(entry: EnvironmentVariableEntry): EnvironmentVariableRow {
  return { key: entry.key, value: entry.value };
}

function defaultEditableRows<TRow extends EnvironmentVariableRow>(rows: readonly TRow[]) {
  return rows;
}

function defaultPreservedRows<TRow extends EnvironmentVariableRow>() {
  return [] as TRow[];
}

function normalizeRows<TRow extends EnvironmentVariableRow>(
  rows: readonly TRow[] | undefined,
  createDefaultRow: () => TRow,
) {
  return rows && rows.length > 0 ? rows.map(row => ({ ...row })) : [createDefaultRow()];
}

function hasOnlyEmptyRow(rows: readonly EnvironmentVariableEntry[]) {
  return rows.length === 1 && !rows[0].key.trim() && !rows[0].value;
}

function areRowsEqual(a: readonly EnvironmentVariableEntry[], b: readonly EnvironmentVariableEntry[]) {
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index++) {
    if (a[index].key !== b[index].key || a[index].value !== b[index].value) {
      return false;
    }
  }

  return true;
}

export function useEnvironmentVariablesEditor<TRow extends EnvironmentVariableRow = EnvironmentVariableRow>({
  initialRows,
  rows: controlledRows,
  onRowsChange,
  createDefaultRow = createEmptyEnvironmentVariableEntry as () => TRow,
  createRow = defaultCreateRow as (entry: EnvironmentVariableEntry) => TRow,
  getEditableRows = defaultEditableRows,
  getPreservedRows = defaultPreservedRows,
  maxUploadSize,
}: UseEnvironmentVariablesEditorOptions<TRow> = {}): EnvironmentVariablesEditorController<TRow> {
  const initialSourceRows = controlledRows ?? initialRows;
  const nextRowId = useRef(0);
  const fallbackRowIds = useRef<Record<number, string>>({});
  const [uncontrolledRows, setUncontrolledRows] = useState(() => normalizeRows(initialSourceRows, createDefaultRow));
  const [baselineRows, setBaselineRows] = useState(() => normalizeRows(initialSourceRows, createDefaultRow));
  const [rowIds, setRowIds] = useState(() =>
    normalizeRows(initialSourceRows, createDefaultRow).map(() => createRowId()),
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [revealedValues, setRevealedValues] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = controlledRows ? normalizeRows(controlledRows, createDefaultRow) : uncontrolledRows;
  const editableRows = (sourceRows: readonly TRow[] = rows) => getEditableRows(sourceRows);
  const preservedRows = (sourceRows: readonly TRow[] = rows) => getPreservedRows(sourceRows);

  function createRowId() {
    const rowId = nextRowId.current;
    nextRowId.current += 1;
    return `environment-variable-row-${rowId}`;
  }

  function commitRows(nextRows: readonly TRow[], nextRowIds?: readonly string[]) {
    const normalizedRows = normalizeRows(nextRows, createDefaultRow);
    const normalizedRowIds = normalizedRows.map((_, index) => nextRowIds?.[index] ?? rowIds[index] ?? createRowId());

    if (!controlledRows) {
      setUncontrolledRows(normalizedRows);
    }

    setRowIds(normalizedRowIds);
    onRowsChange?.(normalizedRows);
    return normalizedRows;
  }

  function setRows(nextRows: readonly TRow[]) {
    return commitRows(nextRows);
  }

  function resetRows(nextRows: readonly TRow[] = baselineRows) {
    const normalizedRows = normalizeRows(nextRows, createDefaultRow);
    commitRows(
      normalizedRows,
      normalizedRows.map(() => createRowId()),
    );
    setBaselineRows(normalizedRows);
    setRevealedValues({});
    setUploadError(null);
    return normalizedRows;
  }

  function getRowsForSubmit() {
    return [...rows];
  }

  function appendRow(row = createDefaultRow()) {
    return commitRows([...rows, row], [...rowIds, createRowId()]);
  }

  function updateRow(index: number, patch: Partial<EnvironmentVariableEntry>) {
    return commitRows(
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
      rowIds,
    );
  }

  function removeRow(index: number) {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    const nextRowIds = rowIds.filter((_, rowIndex) => rowIndex !== index);
    setRevealedValues({});
    return commitRows(
      nextRows.length > 0 ? nextRows : [createDefaultRow()],
      nextRows.length > 0 ? nextRowIds : [createRowId()],
    );
  }

  function mergeParsedRows(parsedRows: readonly EnvironmentVariableEntry[], targetIndex?: number) {
    const newRows = parsedRows.map(createRow);
    const newRowIds = newRows.map(() => createRowId());
    const currentEditableRows = editableRows(rows);

    if (hasOnlyEmptyRow(currentEditableRows)) {
      const preserved = preservedRows(rows);
      return commitRows([...preserved, ...newRows] as TRow[], [...rowIds.slice(0, preserved.length), ...newRowIds]);
    }

    if (typeof targetIndex !== 'number') {
      return commitRows([...rows, ...newRows] as TRow[], [...rowIds, ...newRowIds]);
    }

    const targetRow = rows[targetIndex];
    if (!targetRow) {
      return commitRows([...rows, ...newRows] as TRow[], [...rowIds, ...newRowIds]);
    }

    const targetIsEmpty = !targetRow.key.trim() && !targetRow.value;
    const before = rows.slice(0, targetIndex + (targetIsEmpty ? 0 : 1));
    const after = rows.slice(targetIndex + 1);
    const beforeIds = rowIds.slice(0, targetIndex + (targetIsEmpty ? 0 : 1));
    const afterIds = rowIds.slice(targetIndex + 1);
    return commitRows([...before, ...newRows, ...after] as TRow[], [...beforeIds, ...newRowIds, ...afterIds]);
  }

  function handlePaste(index: number, text: string) {
    const entries = parsePastedEnvText(text);
    if (entries.length === 0) return false;

    mergeParsedRows(entries, index);
    setRevealedValues({});
    setUploadError(null);
    return true;
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await readEnvFile(file, { maxSize: maxUploadSize });
    if (!result.ok) {
      setUploadError(result.error);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    mergeParsedRows(result.entries);
    setRevealedValues({});

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const duplicateKeys = getDuplicateEnvironmentVariableKeys(rows);
  const rowsDirty = !areRowsEqual(rows, baselineRows);

  return {
    rows,
    uploadError,
    fileInputRef,
    duplicateKeys,
    hasDuplicateKeys: duplicateKeys.size > 0,
    isDirty: rowsDirty,
    isRowsDirty: rowsDirty,
    setRows,
    resetRows,
    appendRow,
    updateRow,
    removeRow,
    getRowsForSubmit,
    getEnvironmentVariablesForSubmit: () => collectEnvironmentVariables(getRowsForSubmit()),
    handleFileUpload,
    handlePaste,
    clearUploadError: () => setUploadError(null),
    getRowId: index => rowIds[index] ?? (fallbackRowIds.current[index] ??= createRowId()),
    isValueRevealed: index => Boolean(revealedValues[index]),
    toggleValueVisibility: index => setRevealedValues(previous => ({ ...previous, [index]: !previous[index] })),
    rowHasDuplicateKey: index => duplicateKeys.has(rows[index]?.key.trim() ?? ''),
  };
}

function parsePastedEnvText(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText.includes('=')) return [];

  const entries = parseEnvFileText(trimmedText);
  if (entries.length === 0) return [];

  const firstAssignmentLooksLikeEnvVar = /^(?:export\s+)?[A-Z_][A-Z0-9_]*\s*=/.test(trimmedText);
  const hasBulkShape = entries.length > 1 || trimmedText.includes('\n') || firstAssignmentLooksLikeEnvVar;

  return hasBulkShape ? entries : [];
}
