import { not } from '../logical_operator';

function null_or_undefined_or_nan(value: Date): boolean {
  return value === null || value === undefined || isNaN(value.getTime());
}

function eq_for_dates(field: string, value: Date): any {
  if (null_or_undefined_or_nan(value)) {
    return {};
  }
  return {
    field: field,
    start: value,
    end: value,
    inclusive_start: true,
    inclusive_end: true,
  };
}

function ne_for_dates(field: string, value: Date): any {
  return not(eq_for_dates(field, value));
}

function gt_for_dates(field: string, value: Date): any {
  if (null_or_undefined_or_nan(value)) {
    return {};
  }
  return {
    field: field,
    start: value,
    inclusive_start: false,
  };
}

function gte_for_dates(field: string, value: Date): any {
  if (null_or_undefined_or_nan(value)) {
    return {};
  }
  return {
    field: field,
    start: value,
  };
}

function lt_for_dates(field: string, value: Date): any {
  if (null_or_undefined_or_nan(value)) {
    return {};
  }
  return {
    field: field,
    end: value,
    inclusive_start: false,
  };
}

function lte_for_dates(field: string, value: Date): any {
  if (null_or_undefined_or_nan(value)) {
    return {};
  }
  return {
    field: field,
    end: value,
    inclusive_end: true,
    inclusive_start: false,
  };
}

function Date_Handler(field: string, value: Record<string, any>): any {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return {};
  }

  const result: { conjuncts: any[] } = { conjuncts: [] };
  for (const op in value) {
    switch (op) {
      case '$eq':
        result.conjuncts.push(eq_for_dates(field, value[op]));
        break;
      case '$ne':
        result.conjuncts.push(ne_for_dates(field, value[op]));
        break;
      case '$gt':
        result.conjuncts.push(gt_for_dates(field, value[op]));
        break;
      case '$gte':
        result.conjuncts.push(gte_for_dates(field, value[op]));
        break;
      case '$lt':
        result.conjuncts.push(lt_for_dates(field, value[op]));
        break;
      case '$lte':
        result.conjuncts.push(lte_for_dates(field, value[op]));
        break;
      default:
        throw new Error(`Unsupported operator: ${op} for date field ${field}`);
    }
  }
  return result;
}

export { Date_Handler };
