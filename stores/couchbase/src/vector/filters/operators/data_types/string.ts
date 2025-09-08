import { not } from '../logical_operator';

function eq_for_strings(field: string, value: string): any {
  if (value === null || value === undefined || value.length === 0) {
    return {};
  }
  return {
    field: field,
    term: value,
  };
}

function ne_for_strings(field: string, value: string): any {
  return not(eq_for_strings(field, value));
}

function String_Handler(field: string, value: Record<string, any>): any {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return {};
  }

  const result: { conjuncts: any[] } = { conjuncts: [] };
  for (const op in value) {
    switch (op) {
      case '$eq':
        result.conjuncts.push(eq_for_strings(field, value[op]));
        break;
      case '$ne':
        result.conjuncts.push(ne_for_strings(field, value[op]));
        break;
      default:
        throw new Error(`Unsupported operator: ${op} for string field ${field}`);
    }
  }
  return result;
}

export { String_Handler };

function qv_eq_for_strings(field: string, value: string): any {
  if (value === null || value === undefined || value.length === 0) {
    return '';
  }
  return `(${field} = '${value}')`;
}

function qv_ne_for_strings(field: string, value: string): any {
  return `(${field} != '${value}')`;
}

function qv_String_Handler(field: string, value: Record<string, any>): any {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return '';
  }

  const result: string[] = [];
  for (const op in value) {
    switch (op) {
      case '$eq':
        result.push(qv_eq_for_strings(field, value[op]));
        break;
      case '$ne':
        result.push(qv_ne_for_strings(field, value[op]));
        break;
      default:
        throw new Error(`Unsupported operator: ${op} for string field ${field}`);
    }
  }
  return result.join(' AND ');
}

export { qv_String_Handler };
