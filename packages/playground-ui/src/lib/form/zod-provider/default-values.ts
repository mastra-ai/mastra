import { getDef, getDefaultValue, getLiteralValue, getShape } from './compat';

export function getDefaultValueInZodStack(schema: any): any {
  const def = getDef(schema);
  if (!def) return undefined;

  // ZodDefault — has defaultValue
  const defaultVal = getDefaultValue(schema);
  if (defaultVal !== undefined) {
    return defaultVal;
  }

  // ZodLiteral — use the literal value as default since it's the only valid option
  const literalVal = getLiteralValue(schema);
  if (
    literalVal !== undefined &&
    (def.typeName === 'ZodLiteral' || def.type === 'literal' || schema?.constructor?.name?.slice(1) === 'ZodLiteral')
  ) {
    return literalVal;
  }

  // Unwrap inner types (ZodOptional, ZodNullable, ZodEffects, etc.)
  if ('innerType' in def) {
    return getDefaultValueInZodStack(def.innerType);
  }

  if ('schema' in def) {
    return getDefaultValueInZodStack(def.schema);
  }

  // ZodObject — recurse into shape
  const shape = getShape(schema);
  if (shape && !('left' in def)) {
    return getDefaultValues(schema);
  }

  // ZodIntersection — merge left and right defaults
  if ('left' in def && 'right' in def) {
    const leftShape = getShape(def.left);
    const rightShape = getShape(def.right);
    const left = leftShape ? getDefaultValues(def.left) : getDefaultValueInZodStack(def.left);
    const right = rightShape ? getDefaultValues(def.right) : getDefaultValueInZodStack(def.right);
    return { ...left, ...right };
  }

  return undefined;
}

export function getDefaultValues(schema: any): Record<string, any> {
  const shape = getShape(schema);
  if (!shape) return {};

  const defaultValues: Record<string, any> = {};

  for (const [key, field] of Object.entries(shape)) {
    const defaultValue = getDefaultValueInZodStack(field);
    if (defaultValue !== undefined) {
      defaultValues[key] = defaultValue;
    }
  }

  return defaultValues;
}
