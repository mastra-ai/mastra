import { not } from '../logical_operator';

function null_or_undefined_or_nan_or_infinite(value: number): boolean {
  return value === null || value === undefined || isNaN(value) || !isFinite(value);
}

function normalize_number(value: number): number {
  if (typeof value === 'number' && Object.is(value, -0)) {
    return 0;
  }
  return value;
}

function eq_for_numbers(field: string, value: number): any {
  if (null_or_undefined_or_nan_or_infinite(value)) {
    return {};
  }
  value = normalize_number(value);
  return {
    field: field,
    min: value,
    max: value,
    inclusive_min: true,
    inclusive_max: true,
  };
}

function ne_for_numbers(field: string, value: number): any {
  return not(eq_for_numbers(field, value));
}

function gt_for_numbers(field: string, value: number): any {
  if (null_or_undefined_or_nan_or_infinite(value)) {
    return {};
  }
  value = normalize_number(value);
  return {
    field: field,
    min: value,
    inclusive_min: false,
  };
}

function gte_for_numbers(field: string, value: number): any {
  if (null_or_undefined_or_nan_or_infinite(value)) {
    return {};
  }
  value = normalize_number(value);
  return {
    field: field,
    min: value,
  };
}

function lt_for_numbers(field: string, value: number): any {
  if (null_or_undefined_or_nan_or_infinite(value)) {
    return {};
  }
  value = normalize_number(value);
  return {
    field: field,
    max: value,
    inclusive_min: false,
  };
}

function lte_for_numbers(field: string, value: number): any {
  if (null_or_undefined_or_nan_or_infinite(value)) {
    return {};
  }
  value = normalize_number(value);
  return {
    field: field,
    max: value,
    inclusive_max: true,
    inclusive_min: false,
  };
}

function Number_Handler(field: string, value: Record<string, any>): any {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return {};
  }

  const result: { conjuncts: any[] } = { conjuncts: [] };
  for (const op in value) {
    switch (op) {
      case '$eq':
        result.conjuncts.push(eq_for_numbers(field, value[op]));
        break;
      case '$ne':
        result.conjuncts.push(ne_for_numbers(field, value[op]));
        break;
      case '$gt':
        result.conjuncts.push(gt_for_numbers(field, value[op]));
        break;
      case '$gte':
        result.conjuncts.push(gte_for_numbers(field, value[op]));
        break;
      case '$lt':
        result.conjuncts.push(lt_for_numbers(field, value[op]));
        break;
      case '$lte':
        result.conjuncts.push(lte_for_numbers(field, value[op]));
        break;
      default:
        throw new Error(`Unsupported operator: ${op} for number field ${field}`);
    }
  }
  return result;
}

export { Number_Handler };
