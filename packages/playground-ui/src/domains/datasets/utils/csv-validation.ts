/**
 * CSV validation utilities for dataset import
 * Validates mapped data before import, including schema validation
 */

import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { resolveSerializedZodOutput } from '@/lib/form/utils';

/** Column mapping configuration */
export type ColumnMapping = Record<string, 'input' | 'groundTruth' | 'metadata' | 'ignore'>;

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

/** Field-level validation error from schema validation */
export interface FieldError {
  path: string;
  code: string;
  message: string;
}

/** Validation result for a single row */
export interface RowValidationResult {
  rowNumber: number; // 1-indexed, +1 for header
  field: 'input' | 'groundTruth';
  errors: FieldError[];
  data: unknown;
}

/** Overall CSV schema validation result */
export interface CsvValidationResult {
  validCount: number;
  invalidCount: number;
  validRows: Array<{ rowNumber: number; input: unknown; groundTruth?: unknown }>;
  invalidRows: RowValidationResult[];
  totalRows: number;
}

/**
 * Convert JSON Schema to runtime Zod schema.
 * Uses existing resolveSerializedZodOutput from lib/form/utils.
 */
function compileSchema(jsonSchema: Record<string, unknown>): ZodSchema {
  const zodString = jsonSchemaToZod(jsonSchema);
  return resolveSerializedZodOutput(zodString);
}

/**
 * Format Zod errors into FieldError array (max 5 per row).
 */
function formatErrors(error: ZodError): FieldError[] {
  return error.issues.slice(0, 5).map((issue: ZodIssue) => ({
    // Convert Zod path array to JSON Pointer string
    path: issue.path.length > 0 ? '/' + issue.path.join('/') : '/',
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Validate CSV rows against dataset schemas.
 *
 * @param rows Mapped rows from CSV (with input/groundTruth fields)
 * @param inputSchema JSON Schema for input field (null = skip validation)
 * @param groundTruthSchema JSON Schema for groundTruth field (null = skip validation)
 * @param maxErrors Maximum number of invalid rows to collect details for (default 10)
 */
export function validateCsvRows(
  rows: Array<{ input: unknown; groundTruth?: unknown }>,
  inputSchema: Record<string, unknown> | null | undefined,
  groundTruthSchema: Record<string, unknown> | null | undefined,
  maxErrors = 10,
): CsvValidationResult {
  // No schemas = all rows valid
  if (!inputSchema && !groundTruthSchema) {
    return {
      validCount: rows.length,
      invalidCount: 0,
      validRows: rows.map((row, i) => ({ rowNumber: i + 2, ...row })),
      invalidRows: [],
      totalRows: rows.length,
    };
  }

  // Pre-compile schemas for performance
  const inputValidator = inputSchema ? compileSchema(inputSchema) : null;
  const outputValidator = groundTruthSchema ? compileSchema(groundTruthSchema) : null;

  const validRows: CsvValidationResult['validRows'] = [];
  const invalidRows: CsvValidationResult['invalidRows'] = [];
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for 0-index, +1 for header row
    let isValid = true;
    let rowInvalidDetails: RowValidationResult | null = null;

    // Validate input
    if (inputValidator) {
      const result = inputValidator.safeParse(row.input);
      if (!result.success) {
        isValid = false;
        // Only collect details up to maxErrors
        if (invalidRows.length < maxErrors) {
          rowInvalidDetails = {
            rowNumber,
            field: 'input',
            errors: formatErrors(result.error),
            data: row.input,
          };
        }
      }
    }

    // Validate groundTruth (only if schema enabled, value provided, and input was valid)
    if (isValid && outputValidator && row.groundTruth !== undefined) {
      const result = outputValidator.safeParse(row.groundTruth);
      if (!result.success) {
        isValid = false;
        // Only collect details up to maxErrors
        if (invalidRows.length < maxErrors) {
          rowInvalidDetails = {
            rowNumber,
            field: 'groundTruth',
            errors: formatErrors(result.error),
            data: row.groundTruth,
          };
        }
      }
    }

    if (isValid) {
      validRows.push({ rowNumber, ...row });
    } else {
      invalidCount++;
      if (rowInvalidDetails) {
        invalidRows.push(rowInvalidDetails);
      }
    }
  }

  return {
    validCount: validRows.length,
    invalidCount,
    validRows,
    invalidRows,
    totalRows: rows.length,
  };
}

/**
 * Validate mapped CSV data before import (basic validation without schemas).
 * Checks that input columns are mapped and values are present.
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
