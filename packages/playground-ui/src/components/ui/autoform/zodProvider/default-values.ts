import z from 'zod/v4';

export function getDefaultValueInZodStack(schema: z.core.$ZodType): any {
  if (schema instanceof z.core.$ZodDefault) {
    return schema._zod.def.defaultValue;
  } else if ('innerType' in schema._zod.def) {
    return getDefaultValueInZodStack(schema._zod.def.innerType as z.core.$ZodType);
  } else if ('shape' in schema._zod.def) {
    return getDefaultValues(schema as z.core.$ZodObject);
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
