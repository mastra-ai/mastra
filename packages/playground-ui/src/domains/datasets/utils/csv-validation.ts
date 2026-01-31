/**
 * CSV validation utilities for dataset import
 * Validates mapped data before import
 */

/** Column mapping configuration */
export type ColumnMapping = Record<string, 'input' | 'expectedOutput' | 'metadata' | 'ignore'>;

/** Validation error for a specific row/column */
export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

/** Result of validation */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate mapped CSV data before import
 * @param data - Parsed CSV rows
 * @param mapping - Column mapping configuration
 * @returns Validation result with errors
 */
export function validateMappedData(data: Record<string, unknown>[], mapping: ColumnMapping): ValidationResult {
  const errors: ValidationError[] = [];

  // Find input columns
  const inputColumns = Object.entries(mapping)
    .filter(([, role]) => role === 'input')
    .map(([col]) => col);

  // Check: at least one column mapped to 'input'
  if (inputColumns.length === 0) {
    errors.push({
      row: 0, // Header-level error
      column: '',
      message: 'At least one column must be mapped to input',
    });
    return { valid: false, errors };
  }

  // Validate each row
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // Row numbers: 1-indexed + 1 for header (first data row is 2)
    const rowNumber = i + 2;

    // Check each input column has a value
    for (const col of inputColumns) {
      const value = row[col];

      if (value === null || value === undefined || value === '') {
        errors.push({
          row: rowNumber,
          column: col,
          message: `Input column "${col}" cannot be empty`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
