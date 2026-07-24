import type { JsonSchema, JsonSchemaObject, Options, Refs } from 'json-schema-to-zod';
import jsonSchemaToZodOriginal, {
  addJsdocs,
  its,
  parseAllOf,
  parseAnyOf,
  parseOneOf,
  parseSchema,
} from 'json-schema-to-zod';
import { z } from 'zod';

function parseObject(objectSchema: JsonSchemaObject & { type: 'object' }, refs: Refs): string {
  let properties: string | undefined = undefined;

  if (objectSchema.properties) {
    if (!Object.keys(objectSchema.properties).length) {
      properties = 'z.object({})';
    } else {
      properties = 'z.object({ ';

      properties += Object.keys(objectSchema.properties)
        .map(key => {
          const propSchema = objectSchema.properties![key];

          let result = `${JSON.stringify(key)}: ${parseSchema(propSchema!, {
            ...refs,
            path: [...refs.path, 'properties', key],
          })}`;

          if (refs.withJsdocs && typeof propSchema === 'object') {
            result = addJsdocs(propSchema, result);
          }

          const hasDefault = typeof propSchema === 'object' && propSchema.default !== undefined;

          const required = Array.isArray(objectSchema.required)
            ? objectSchema.required.includes(key)
            : typeof propSchema === 'object' && propSchema.required === true;

          const optional = !hasDefault && !required;

          return optional ? `${result}.optional()` : result;
        })
        .join(', ');

      properties += ' })';
    }
  }

  const additionalProperties =
    objectSchema.additionalProperties !== undefined && objectSchema.additionalProperties !== false
      ? parseSchema(objectSchema.additionalProperties, {
          ...refs,
          path: [...refs.path, 'additionalProperties'],
        })
      : undefined;

  let patternProperties: string | undefined = undefined;

  if (objectSchema.patternProperties) {
    const parsedPatternProperties = Object.fromEntries(
      Object.entries(objectSchema.patternProperties).map(([key, value]) => {
        return [
          key,
          parseSchema(value, {
            ...refs,
            path: [...refs.path, 'patternProperties', key],
          }),
        ];
      }, {}),
    );

    patternProperties = '';

    if (properties) {
      if (additionalProperties) {
        patternProperties += `.catchall(z.union([${[
          ...Object.values(parsedPatternProperties),
          additionalProperties,
        ].join(', ')}]))`;
      } else if (Object.keys(parsedPatternProperties).length > 1) {
        patternProperties += `.catchall(z.union([${Object.values(parsedPatternProperties).join(', ')}]))`;
      } else {
        patternProperties += `.catchall(${Object.values(parsedPatternProperties)})`;
      }
    } else {
      if (additionalProperties) {
        patternProperties += `z.record(z.union([${[
          ...Object.values(parsedPatternProperties),
          additionalProperties,
        ].join(', ')}]))`;
      } else if (Object.keys(parsedPatternProperties).length > 1) {
        patternProperties += `z.record(z.union([${Object.values(parsedPatternProperties).join(', ')}]))`;
      } else {
        patternProperties += `z.record(${Object.values(parsedPatternProperties)})`;
      }
    }

    patternProperties += '.superRefine((value, ctx) => {\n';

    patternProperties += 'for (const key in value) {\n';

    if (additionalProperties) {
      if (objectSchema.properties) {
        patternProperties += `let evaluated = [${Object.keys(objectSchema.properties)
          .map(key => JSON.stringify(key))
          .join(', ')}].includes(key)\n`;
      } else {
        patternProperties += `let evaluated = false\n`;
      }
    }

    for (const key in objectSchema.patternProperties) {
      patternProperties += 'if (key.match(new RegExp(' + JSON.stringify(key) + '))) {\n';
      if (additionalProperties) {
        patternProperties += 'evaluated = true\n';
      }
      patternProperties += 'const result = ' + parsedPatternProperties[key] + '.safeParse(value[key])\n';
      patternProperties += 'if (!result.success) {\n';

      patternProperties += `ctx.addIssue({
          path: [...ctx.path, key],
          code: 'custom',
          message: \`Invalid input: Key matching regex /\${key}/ must match schema\`,
          params: {
            issues: result.error.issues
          }
        })\n`;

      patternProperties += '}\n';
      patternProperties += '}\n';
    }

    if (additionalProperties) {
      patternProperties += 'if (!evaluated) {\n';
      patternProperties += 'const result = ' + additionalProperties + '.safeParse(value[key])\n';
      patternProperties += 'if (!result.success) {\n';

      patternProperties += `ctx.addIssue({
          path: [...ctx.path, key],
          code: 'custom',
          message: \`Invalid input: must match catchall schema\`,
          params: {
            issues: result.error.issues
          }
        })\n`;

      patternProperties += '}\n';
      patternProperties += '}\n';
    }
    patternProperties += '}\n';
    patternProperties += '})';
  }

  let output = properties
    ? patternProperties
      ? properties + patternProperties
      : additionalProperties
        ? additionalProperties === 'z.never()'
          ? properties + '.strict()'
          : properties + `.catchall(${additionalProperties})`
        : properties
    : patternProperties
      ? patternProperties
      : additionalProperties
        ? `z.record(${additionalProperties})`
        : 'z.record(z.any())';

  if (its.an.anyOf(objectSchema)) {
    output += `.and(${parseAnyOf(
      {
        ...objectSchema,
        anyOf: objectSchema.anyOf.map(x =>
          typeof x === 'object' && !x.type && (x.properties || x.additionalProperties || x.patternProperties)
            ? { ...x, type: 'object' }
            : x,
        ) as any,
      },
      refs,
    )})`;
  }

  if (its.a.oneOf(objectSchema)) {
    output += `.and(${parseOneOf(
      {
        ...objectSchema,
        oneOf: objectSchema.oneOf.map(x =>
          typeof x === 'object' && !x.type && (x.properties || x.additionalProperties || x.patternProperties)
            ? { ...x, type: 'object' }
            : x,
        ) as any,
      },
      refs,
    )})`;
  }

  if (its.an.allOf(objectSchema)) {
    output += `.and(${parseAllOf(
      {
        ...objectSchema,
        allOf: objectSchema.allOf.map(x =>
          typeof x === 'object' && !x.type && (x.properties || x.additionalProperties || x.patternProperties)
            ? { ...x, type: 'object' }
            : x,
        ) as any,
      },
      refs,
    )})`;
  }

  return output;
}

const parserOverride = (schema: JsonSchemaObject, refs: Refs) => {
  let parsed = '';
  let seen = refs.seen.get(schema);
  if (its.an.anyOf(schema)) {
    const allObjects = schema.anyOf.every(
      item => typeof item === 'object' && its.an.object(item) && item.properties !== undefined,
    );
    if (schema.anyOf.length > 1 && allObjects) {
      const propertiesWithConst: string[][] = schema.anyOf.reduce((acc, item) => {
        if (typeof item === 'object' && its.an.object(item)) {
          const propertyWithConst = Object.entries(item.properties ?? {}).filter(
            ([_, value]) => typeof value === 'object' && (value as any)?.const !== undefined,
          );
          if (propertyWithConst?.length) {
            const ppties = propertyWithConst.map(([key, _]) => key);
            acc.push(ppties);
          }
        }
        return acc;
      }, [] as string[][]);

      if (propertiesWithConst.length === schema.anyOf.length) {
        if (seen) {
          if (seen.r !== undefined) {
            return seen.r;
          }

          if (refs.depth === undefined || seen.n >= refs.depth) {
            return 'z.any()';
          }

          seen.n += 1;
        } else {
          seen = { r: undefined, n: 0 };
          refs.seen.set(schema, seen);
        }

        const discriminators =
          propertiesWithConst.length > 0 && propertiesWithConst[0]
            ? propertiesWithConst.reduce((common, properties) => {
                return common.filter(prop => properties.includes(prop));
              }, propertiesWithConst[0])
            : [];

        if (discriminators.length > 0) {
          const discriminator = discriminators[0];
          if (discriminator) {
            parsed = `z.discriminatedUnion("${discriminator}", [${schema.anyOf
              .map((schema, i) =>
                parseSchema(schema, {
                  ...refs,
                  path: [...refs.path, 'anyOf', i],
                }),
              )
              .join(', ')}])`;
          }
        }
      }
    }
  } else if (its.an.object(schema)) {
    if (seen) {
      if (seen.r !== undefined) {
        return seen.r;
      }

      if (refs.depth === undefined || seen.n >= refs.depth) {
        return 'z.any()';
      }

      seen.n += 1;
    } else {
      seen = { r: undefined, n: 0 };
      refs.seen.set(schema, seen);
    }

    parsed = parseObject(schema, refs);
  }
  if (parsed) {
    if (!refs.withoutDescribes) {
      parsed = addDescribes(schema, parsed);
    }

    if (!refs.withoutDefaults) {
      parsed = addDefaults(schema, parsed);
    }

    parsed = addAnnotations(schema, parsed);

    if (seen) {
      seen.r = parsed;
    }

    return parsed;
  }
};

const addDescribes = (schema: JsonSchemaObject, parsed: string): string => {
  if (schema.description) {
    parsed += `.describe(${JSON.stringify(schema.description)})`;
  }

  return parsed;
};

const addDefaults = (schema: JsonSchemaObject, parsed: string): string => {
  if (schema.default !== undefined) {
    parsed += `.default(${JSON.stringify(schema.default)})`;
  }

  return parsed;
};

const addAnnotations = (schema: JsonSchemaObject, parsed: string): string => {
  if (schema.readOnly) {
    parsed += '.readonly()';
  }

  return parsed;
};

export function jsonSchemaToZod(schema: JsonSchema, options: Options = {}): string {
  const result = jsonSchemaToZodOriginal(schema, { ...options, parserOverride });

  // Fix: The upstream json-schema-to-zod generates TypeScript syntax `reduce<z.ZodError[]>`
  // in parseOneOf which fails when evaluated at runtime with Function().
  // This catches any oneOf usage that bypasses our parserOverride (e.g., non-object contexts).
  // See: https://github.com/mastra-ai/mastra/issues/11610
  return result.replace(/\.reduce<[^>]+>/g, '.reduce');
}

// Re-export all named exports from json-schema-to-zod (excluding the default export)
export * from 'json-schema-to-zod';

export function jsonSchemaToZodRuntime(schema: JsonSchema): z.ZodType {
  return parseSchemaRuntime(schema, {});
}

function parseSchemaRuntime(schema: JsonSchema, defs: Record<string, z.ZodType>): z.ZodType {
  if (typeof schema === 'boolean') {
    return schema ? z.any() : z.never();
  }

  if ('$ref' in schema && typeof schema.$ref === 'string') {
    const refName = schema.$ref.replace('#/$defs/', '').replace('#/definitions/', '');
    if (defs[refName]) return defs[refName]!;
    return z.any();
  }

  const localDefs = { ...defs };
  const rawDefs = (schema as any).$defs ?? (schema as any).definitions;
  if (rawDefs) {
    for (const [key, defSchema] of Object.entries(rawDefs)) {
      localDefs[key] = parseSchemaRuntime(defSchema as JsonSchema, localDefs);
    }
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    const options = schema.oneOf.map(s => parseSchemaRuntime(s as JsonSchema, localDefs));
    return z.union(options as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }
  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    const options = schema.anyOf.map(s => parseSchemaRuntime(s as JsonSchema, localDefs));
    return z.union(options as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }
  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    const [first, ...rest] = schema.allOf.map(s => parseSchemaRuntime(s as JsonSchema, localDefs));
    return rest.reduce((acc, s) => acc.and(s), first as z.ZodType);
  }

  if ('enum' in schema && Array.isArray(schema.enum)) {
    const values = schema.enum as [unknown, ...unknown[]];
    return z.enum(values.map(String) as [string, ...string[]]);
  }

  if ('const' in schema) {
    return z.literal(schema.const as any);
  }

  const type = (schema as any).type;

  if (Array.isArray(type)) {
    const options = type.map(t => parseSchemaRuntime({ type: t } as JsonSchema, localDefs));
    return z.union(options as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  }

  switch (type) {
    case 'string': {
      let s = z.string();
      if ((schema as any).minLength !== undefined) s = s.min((schema as any).minLength);
      if ((schema as any).maxLength !== undefined) s = s.max((schema as any).maxLength);
      return applyMeta(schema, s);
    }
    case 'number':
    case 'integer': {
      let n = z.number();
      if ((schema as any).minimum !== undefined) n = n.min((schema as any).minimum);
      if ((schema as any).maximum !== undefined) n = n.max((schema as any).maximum);
      return applyMeta(schema, n);
    }
    case 'boolean':
      return applyMeta(schema, z.boolean());
    case 'null':
      return z.null();
    case 'array': {
      const items = (schema as any).items;
      const itemType = items ? parseSchemaRuntime(items as JsonSchema, localDefs) : z.any();
      let arr = z.array(itemType);
      if ((schema as any).minItems !== undefined) arr = arr.min((schema as any).minItems);
      if ((schema as any).maxItems !== undefined) arr = arr.max((schema as any).maxItems);
      return applyMeta(schema, arr);
    }
    case 'object': {
      const properties = (schema as any).properties as Record<string, JsonSchema> | undefined;
      const required: string[] = (schema as any).required ?? [];
      const additionalProperties = (schema as any).additionalProperties;

      if (!properties || Object.keys(properties).length === 0) {
        if (additionalProperties !== undefined && additionalProperties !== false) {
          const valueType =
            typeof additionalProperties === 'boolean'
              ? z.any()
              : parseSchemaRuntime(additionalProperties as JsonSchema, localDefs);
          return applyMeta(schema, z.record(z.string(), valueType));
        }
        return applyMeta(schema, z.record(z.string(), z.any()));
      }

      const shape: Record<string, z.ZodType> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const isRequired = required.includes(key);
        const parsed = parseSchemaRuntime(propSchema, localDefs);
        shape[key] = isRequired ? parsed : parsed.optional();
      }

      let obj: z.ZodType = z.object(shape);

      if (additionalProperties !== undefined && additionalProperties !== false) {
        const valueType =
          typeof additionalProperties === 'boolean'
            ? z.any()
            : parseSchemaRuntime(additionalProperties as JsonSchema, localDefs);
        obj = (obj as z.ZodObject<any>).catchall(valueType);
      }

      return applyMeta(schema, obj);
    }
    default:
      return z.any();
  }
}

function applyMeta(schema: JsonSchema, zodType: z.ZodType): z.ZodType {
  if (typeof schema === 'boolean') return zodType;
  let t = zodType;
  if ((schema as any).description) t = t.describe((schema as any).description);
  if ((schema as any).default !== undefined) t = t.default((schema as any).default);
  return t;
}
