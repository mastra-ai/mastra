import type { JsonSchema, JsonSchemaObject, Options, Refs } from 'json-schema-to-zod';
import jsonSchemaToZodOriginal, {
  addJsdocs,
  its,
  parseAllOf,
  parseAnyOf,
  parseOneOf,
  parseSchema,
} from 'json-schema-to-zod';

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
  return jsonSchemaToZodOriginal(schema, { ...options, parserOverride });
}

// Re-export all named exports from json-schema-to-zod (excluding the default export)
export * from 'json-schema-to-zod';
