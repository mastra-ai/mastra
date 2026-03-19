'use client';

import { useCallback, useState } from 'react';
import { validateJSONData, type ImportableItem, type JSONValidationError } from '../utils/json-validation';

/** Result of parsing a JSON file */
export interface ParsedJSON {
  items: ImportableItem[];
  errors: JSONValidationError[];
  rawData: unknown;
}

/**
 * Hook for parsing JSON files for dataset import
 */
export function useJSONParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const parseFile = useCallback(async (file: File): Promise<ParsedJSON> => {
    setIsParsing(true);
    setError(null);

    try {
      // Read file content
      const text = await file.text();

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Invalid JSON format. Please check your file syntax.');
      }

      // Validate structure
      const validation = validateJSONData(data);

      if (!validation.valid) {
        // Return with errors for display, but don't throw
        return {
          items: validation.items,
          errors: validation.errors,
          rawData: data,
        };
      }

      return {
        items: validation.items,
        errors: [],
        rawData: data,
      };
    } catch (err) {
      const parseError = err instanceof Error ? err : new Error('Failed to parse JSON file');
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
