import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Field types for column mapping in CSV import.
 * - input: Data passed to the target (agent/workflow/scorer)
 * - expectedOutput: Ground truth for comparison
 * - metadata: Additional context stored with items
 * - ignore: Columns not imported
 */
export type FieldType = 'input' | 'expectedOutput' | 'metadata' | 'ignore';

/**
 * Mapping of column names to their target field type.
 */
export type ColumnMapping = Record<string, FieldType>;

/**
 * Hook for managing column mapping state in CSV import flow.
 *
 * @param headers - Array of column names from CSV
 * @returns State and actions for column mapping
 */
export function useColumnMapping(headers: string[]) {
  // Initialize all columns as 'ignore' by default
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    headers.reduce<ColumnMapping>((acc, header) => {
      acc[header] = 'ignore';
      return acc;
    }, {}),
  );

  // Rebuild mapping when headers change (handles async CSV parsing)
  useEffect(() => {
    const newMapping: ColumnMapping = {};
    for (const header of headers) {
      newMapping[header] = 'ignore';
    }
    setMapping(newMapping);
  }, [headers]);

  // Update a single column's field type
  const setColumnField = useCallback((column: string, field: FieldType) => {
    setMapping(prev => ({
      ...prev,
      [column]: field,
    }));
  }, []);

  // Reset all columns to 'ignore'
  const resetMapping = useCallback(() => {
    setMapping(
      headers.reduce<ColumnMapping>((acc, header) => {
        acc[header] = 'ignore';
        return acc;
      }, {}),
    );
  }, [headers]);

  // Check if at least one column is mapped to 'input'
  const isInputMapped = useMemo(() => Object.values(mapping).some(field => field === 'input'), [mapping]);

  return {
    mapping,
    setColumnField,
    resetMapping,
    isInputMapped,
  };
}
