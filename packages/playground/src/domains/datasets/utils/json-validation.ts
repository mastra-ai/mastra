/**
 * JSON validation utilities for dataset import
 * Validates JSON structure matches expected format
 */

/** Expected structure of an imported item */
export interface ImportableItem {
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
}

/** Validation error for a specific item */
export interface JSONValidationError {
  index: number;
  message: string;
}

/** Result of JSON validation */
export interface JSONValidationResult {
  valid: boolean;
  errors: JSONValidationError[];
  items: ImportableItem[];
}

/**
 * Validate JSON data for dataset import
 * @param data - Parsed JSON data
 * @returns Validation result with errors and valid items
 */
export function validateJSONData(data: unknown): JSONValidationResult {
  const errors: JSONValidationError[] = [];
  const items: ImportableItem[] = [];

  // Check: must be an array
  if (!Array.isArray(data)) {
    errors.push({
      index: -1,
      message: 'JSON must be an array of items',
    });
    return { valid: false, errors, items };
  }

  // Check: must not be empty
  if (data.length === 0) {
    errors.push({
      index: -1,
      message: 'JSON array must contain at least one item',
    });
    return { valid: false, errors, items };
  }

  // Validate each item
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const itemNum = i + 1; // 1-indexed for user display

    // Check: must be an object
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push({
        index: itemNum,
        message: `Item ${itemNum} must be an object`,
      });
      continue;
    }

    // Check: must have 'input' field
    if (!('input' in item) || item.input === undefined || item.input === null) {
      errors.push({
        index: itemNum,
        message: `Item ${itemNum} is missing required 'input' field`,
      });
      continue;
    }

    // Check: input cannot be empty string
    if (item.input === '') {
      errors.push({
        index: itemNum,
        message: `Item ${itemNum} has empty 'input' field`,
      });
      continue;
    }

    // Check: metadata must be an object if present
    if ('metadata' in item && item.metadata !== undefined && item.metadata !== null) {
      if (typeof item.metadata !== 'object' || Array.isArray(item.metadata)) {
        errors.push({
          index: itemNum,
          message: `Item ${itemNum} has invalid 'metadata' field (must be an object)`,
        });
        continue;
      }
    }

    // Item is valid, add to items array
    items.push({
      input: item.input,
      groundTruth: 'groundTruth' in item ? item.groundTruth : undefined,
      metadata: 'metadata' in item ? (item.metadata as Record<string, unknown>) : undefined,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}
