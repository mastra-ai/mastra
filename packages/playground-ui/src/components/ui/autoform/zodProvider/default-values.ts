import z from 'zod/v4';

export function getDefaultValueInZodStack(schema: z.core.$ZodType): any {
  if (schema instanceof z.core.$ZodDefault) {
    return schema._zod.def.defaultValue;
  } else if ('innerType' in schema._zod.def) {
    return getDefaultValueInZodStack(schema._zod.def.innerType as z.core.$ZodType);
  } else if ('shape' in schema._zod.def) {
    return getDefaultValues(schema as z.core.$ZodObject);
  } else if ('left' in schema._zod.def && 'right' in schema._zod.def) {
    const leftSchema = schema._zod.def.left as z.core.$ZodObject;
    const rightSchema = schema._zod.def.right as z.core.$ZodObject;
    const left =
      'shape' in leftSchema ? getDefaultValues(leftSchema) : getDefaultValueInZodStack(leftSchema as z.core.$ZodType);
    const right =
      'shape' in rightSchema
        ? getDefaultValues(rightSchema)
        : getDefaultValueInZodStack(rightSchema as z.core.$ZodType);
    return { ...left, ...right };
  }
  return undefined;
}

export function getDefaultValues(schema: z.core.$ZodObject): Record<string, any> {
  const shape = schema._zod.def.shape;

  const defaultValues: Record<string, any> = {};

  for (const [key, field] of Object.entries(shape)) {
    const defaultValue = getDefaultValueInZodStack(field);
    if (defaultValue !== undefined) {
      defaultValues[key] = defaultValue;
    }
  }

  return defaultValues;
}
