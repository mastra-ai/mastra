import { not } from '../logical_operator';

function eq_for_booleans(field: string, value: boolean): any {
  if (value === null || value === undefined) {
    return {};
  }
  return {
    field: field,
    bool: value,
  };
}

function ne_for_booleans(field: string, value: boolean): any {
  return not(eq_for_booleans(field, value));
}

function Boolean_Handler(field: string, value: Record<string, any>): any {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return {};
  }

  const result: { conjuncts: any[] } = { conjuncts: [] };
  for (const op in value) {
    switch (op) {
      case '$eq':
        result.conjuncts.push(eq_for_booleans(field, value[op]));
        break;
      case '$ne':
        result.conjuncts.push(ne_for_booleans(field, value[op]));
        break;
      default:
        throw new Error(`Unsupported operator: ${op} for boolean field ${field}`);
    }
  }
  return result;
}

function qv_eq_for_booleans(field: string, value: boolean): any {
  if (value === null || value === undefined) {
    return '';
  }
  return `(${field} = ${value})`;
}

function qv_ne_for_booleans(field: string, value: boolean): any {
  if (value === null || value === undefined) {
    return '';
  }
  return `(${field} != ${value})`;
}

function qv_Boolean_Handler(field: string, value: Record<string, any>): any {
  if (value === null || value === undefined || Object.keys(value).length === 0) {
    return '';
  }

  const result: string[] = [];
  for (const op in value) {
    switch (op) {
      case '$eq':
        result.push(qv_eq_for_booleans(field, value[op]));
        break;
      case '$ne':
        result.push(qv_ne_for_booleans(field, value[op]));
        break;
      default:
        throw new Error(`Unsupported operator: ${op} for boolean field ${field}`);
    }
  }
  const filteredResult = result.filter(result => result && result.length !== 0);
  if (filteredResult.length === 0) {
    return '';
  }
  if (filteredResult.length === 1) {
    return filteredResult[0];
  }
  return filteredResult.join(' AND ');
}

export { Boolean_Handler, qv_Boolean_Handler };
