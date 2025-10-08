import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodSchemaV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

export function zodToJsonSchema(
  zodSchema: ZodSchemaV3 | ZodSchemaV4,
  target: Targets = 'jsonSchema7',
  strategy: 'none' | 'seen' | 'root' | 'relative' = 'relative',
) {
  const fn = 'toJSONSchema';

  // Comprehensive structure logging
  const allKeys = Object.keys(zodSchema);
  const hasStandard = allKeys.includes('~standard');
  const standardPosition = hasStandard ? allKeys.indexOf('~standard') : -1;

  console.log('\n========== ZODTOJS DEBUG START ==========');
  console.log('Node version:', process.version);
  console.log('Schema constructor:', zodSchema?.constructor?.name);
  console.log('Has ~standard:', hasStandard, standardPosition >= 0 ? `at position ${standardPosition}` : '');
  console.log('All keys:', allKeys.join(', '));
  console.log('Total keys:', allKeys.length);

  // Check _def structure
  console.log('\n_def structure:');
  console.log('  _def exists:', '_def' in zodSchema);
  console.log('  _def keys:', zodSchema._def ? Object.keys(zodSchema._def).join(', ') : 'N/A');

  if (fn in z) {
    console.log('\nUsing: z.toJSONSchema (Zod v4)');
    const result = (z as any)[fn](zodSchema, {
      unrepresentable: 'any',
      override: (ctx: any) => {
        const def = ctx.zodSchema?._zod?.def;
        if (def && def.type === 'date') {
          ctx.jsonSchema.type = 'string';
          ctx.jsonSchema.format = 'date-time';
        }
      },
    }) as JSONSchema7;
    console.log('Result type:', result.type);
    console.log('Result has properties:', !!result.properties);
    console.log('========== ZODTOJS DEBUG END ==========\n');
    return result;
  } else {
    console.log('\nUsing: zodToJsonSchemaOriginal (npm package)');
    console.log('Options: target=' + target + ', strategy=' + strategy);

    const result = zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
      $refStrategy: strategy,
      target,
    }) as JSONSchema7;

    console.log('\nResult:');
    console.log('  type:', result.type);
    console.log('  has properties:', !!result.properties);
    console.log('  result keys:', Object.keys(result).join(', '));

    if (!result.type || !result.properties) {
      console.log('  ⚠️  EMPTY SCHEMA DETECTED!');
      console.log('  Full result:', JSON.stringify(result, null, 2));
    }
    console.log('========== ZODTOJS DEBUG END ==========\n');
    return result;
  }
}
