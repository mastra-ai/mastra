'use client';

import { useCallback, useState } from 'react';
import Papa from 'papaparse';
import { parseRow } from '../utils/json-cell-parser';

/** Result of parsing a CSV file */
export interface ParsedCSV {
  headers: string[];
  data: Record<string, unknown>[];
  errors: Papa.ParseError[];
  warnings: string[];
}

/** Size threshold for using web worker (1MB) */
const WORKER_THRESHOLD = 1_000_000;

/**
 * Hook for parsing CSV files with JSON cell handling
 * Uses web worker for large files (>1MB)
 */
export function useCSVParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const parseFile = useCallback(async (file: File): Promise<ParsedCSV> => {
    setIsParsing(true);
    setError(null);

    try {
      const useWorker = file.size > WORKER_THRESHOLD;

      return await new Promise<ParsedCSV>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: 'greedy',
          dynamicTyping: false,
          worker: useWorker,
          complete: results => {
            // Extract headers from first row fields or meta
            const headers = results.meta.fields ?? [];

            // Process each row through JSON cell parser
            const allWarnings: string[] = [];
            const processedData = results.data.map((row, index) => {
              const parsed = parseRow(row);

              // Prefix warnings with row number
              parsed.warnings.forEach(w => {
                allWarnings.push(`Row ${index + 2}: ${w}`);
              });

              return parsed.data;
            });

            resolve({
              headers,
              data: processedData,
              errors: results.errors,
              warnings: allWarnings,
            });
          },
          error: err => {
            reject(new Error(err.message));
          },
        });
      });
    } catch (err) {
      const parseError = err instanceof Error ? err : new Error('Failed to parse CSV');
      setError(parseError);
      throw parseError;
    } finally {
      setIsParsing(false);
    }
  }, []);

  return {
    parseFile,
    isParsing,
    error,
  };
}
