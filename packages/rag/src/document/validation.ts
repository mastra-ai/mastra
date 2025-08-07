import { z } from 'zod';
import type { ChunkStrategy } from './types';

function handleDeprecatedSize<T extends { size?: number; maxSize?: number }>(data: T): Omit<T, 'size'> {
  if (data.size !== undefined) {
    console.warn(
      '[DEPRECATION] `size` is deprecated. Use `maxSize` instead. This will be removed in the next major version.',
    );

    if (data.maxSize === undefined) {
      data.maxSize = data.size;
    }
  }

  const { size, ...rest } = data;
  return rest;
}

// Base options that apply to all strategies
const baseChunkOptionsSchema = z.object({
  size: z.number().positive().optional(),
  maxSize: z.number().positive().optional(),
  overlap: z.number().min(0).optional(),
  lengthFunction: z.function().optional(),
  keepSeparator: z.union([z.boolean(), z.literal('start'), z.literal('end')]).optional(),
  addStartIndex: z.boolean().optional(),
  stripWhitespace: z.boolean().optional(),
});

// Strategy-specific schemas
const characterChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    separator: z.string().optional(),
    isSeparatorRegex: z.boolean().optional(),
  })
  .strict();

const recursiveChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    separators: z.array(z.string()).optional(),
    isSeparatorRegex: z.boolean().optional(),
    language: z.string().optional(),
  })
  .strict();

const sentenceChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    maxSize: z.number().positive(),
    minSize: z.number().positive().optional(),
    targetSize: z.number().positive().optional(),
    sentenceEnders: z.array(z.string()).optional(),
    fallbackToWords: z.boolean().optional(),
    fallbackToCharacters: z.boolean().optional(),
  })
  .strict();

// Predicate to check for Set-like objects
const isSetLike = (value: unknown): value is Set<any> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Set<any>).has === 'function' &&
    typeof (value as Set<any>).add === 'function' &&
    typeof (value as Set<any>).delete === 'function' &&
    typeof (value as Set<any>).clear === 'function' &&
    typeof (value as Set<any>).size === 'number'
  );
};

// Zod schema for a Set or the literal 'all'
const setOrAllSchema = z
  .any()
  .refine(value => value === 'all' || isSetLike(value), {
    message: "Must be a Set object or the literal 'all'",
  })
  .optional();

const tokenChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    encodingName: z.string().optional(),
    modelName: z.string().optional(),
    allowedSpecial: setOrAllSchema,
    disallowedSpecial: setOrAllSchema,
  })
  .strict();

const jsonChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    minSize: z.number().positive().optional(),
    ensureAscii: z.boolean().optional(),
    convertLists: z.boolean().optional(),
  })
  .strict();

const htmlChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    headers: z.array(z.tuple([z.string(), z.string()])).optional(),
    sections: z.array(z.tuple([z.string(), z.string()])).optional(),
    returnEachLine: z.boolean().optional(),
  })
  .strict();

const markdownChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    headers: z.array(z.tuple([z.string(), z.string()])).optional(),
    returnEachLine: z.boolean().optional(),
    stripHeaders: z.boolean().optional(),
  })
  .strict();

const semanticMarkdownChunkOptionsSchema = baseChunkOptionsSchema
  .extend({
    joinThreshold: z.number().positive().optional(),
    encodingName: z.string().optional(),
    modelName: z.string().optional(),
    allowedSpecial: setOrAllSchema,
    disallowedSpecial: setOrAllSchema,
  })
  .strict();

const latexChunkOptionsSchema = baseChunkOptionsSchema.strict();

// Strategy-specific validation schemas
const validationSchemas = {
  character: characterChunkOptionsSchema.transform(handleDeprecatedSize),
  recursive: recursiveChunkOptionsSchema.transform(handleDeprecatedSize),
  sentence: sentenceChunkOptionsSchema.transform(handleDeprecatedSize),
  token: tokenChunkOptionsSchema.transform(handleDeprecatedSize),
  json: jsonChunkOptionsSchema.transform(handleDeprecatedSize),
  html: htmlChunkOptionsSchema.transform(handleDeprecatedSize),
  markdown: markdownChunkOptionsSchema.transform(handleDeprecatedSize),
  'semantic-markdown': semanticMarkdownChunkOptionsSchema.transform(handleDeprecatedSize),
  latex: latexChunkOptionsSchema.transform(handleDeprecatedSize),
} as const;

export function validateChunkParams(strategy: ChunkStrategy, params: any): void {
  const schema = validationSchemas[strategy];
  if (!schema) {
    throw new Error(`Unknown chunking strategy: ${strategy}`);
  }

  const result = schema.safeParse(params);
  if (!result.success) {
    // Extract unrecognized keys for cleaner error message
    const unrecognizedError = result.error.errors.find((e: any) => e.code === 'unrecognized_keys');
    if (unrecognizedError && 'keys' in unrecognizedError) {
      const keys = (unrecognizedError as any).keys.join(', ');
      throw new Error(`Invalid parameters for ${strategy} strategy: '${keys}' not supported`);
    }

    // Fallback to general error message for other validation issues
    const errorMessage = result.error.errors
      .map((e: any) => `${e.path.length > 0 ? e.path.join('.') : 'parameter'}: ${e.message}`)
      .join(', ');

    throw new Error(`Invalid parameters for ${strategy} strategy: ${errorMessage}`);
  }
}
