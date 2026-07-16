import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type * as z4 from 'zod/v4/core';

import { messageSendBodySchema } from './a2a';
import { serializedAgentSchema, agentExecutionBodySchema } from './agents';
import { backgroundTaskStreamResponseSchema } from './background-tasks';
import { coreMessageSchema } from './common';
import { listMessagesResponseSchema } from './memory';
import { executeProcessorBodySchema } from './processors';
import { upsertVectorsBodySchema, queryVectorsBodySchema } from './vectors';
import { timeTravelBodySchema, workflowExecutionResultSchema, workflowRunResultSchema } from './workflows';

/**
 * Regression tests ensuring route schemas use `z.unknown()` instead of `z.any()`.
 *
 * `z.any()` in these schemas leaks `any` into the generated client route types
 * (client-sdks/client-js/src/route-types.generated.ts), silently disabling type
 * checking for consumers. `z.unknown()` produces `unknown`, which forces callers
 * to narrow values before use.
 */

function isZodSchema(value: unknown): value is z4.$ZodType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'def' in value &&
    typeof (value as { def: unknown }).def === 'object' &&
    (value as { def: { type?: unknown } }).def !== null &&
    typeof (value as { def: { type?: unknown } }).def.type === 'string'
  );
}

/** Recursively collect the def types of a schema and all nested schemas. */
function collectDefTypes(schema: z4.$ZodType): Set<string> {
  const types = new Set<string>();
  const visited = new WeakSet<object>();

  function walk(value: unknown): void {
    if (typeof value !== 'object' || value === null) return;
    if (visited.has(value)) return;
    visited.add(value);

    if (isZodSchema(value)) {
      const def = (value as unknown as { def: { type: string } }).def;
      types.add(def.type);
      // `z.lazy()` hides its inner schema behind a getter function, and some
      // versions expose `shape` as a function; unwrap both so nested schemas
      // are not skipped by the object traversal below.
      const getter = (def as { getter?: unknown }).getter;
      if (typeof getter === 'function') walk((getter as () => unknown)());
      const shape = (def as { shape?: unknown }).shape;
      if (typeof shape === 'function') walk((shape as () => unknown)());
      walk(def);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    for (const nested of Object.values(value)) {
      walk(nested);
    }
  }

  walk(schema);
  return types;
}

describe('route schemas must not use z.any()', () => {
  const schemas: Record<string, z4.$ZodType> = {
    messageSendBodySchema,
    serializedAgentSchema,
    agentExecutionBodySchema,
    backgroundTaskStreamResponseSchema,
    coreMessageSchema,
    listMessagesResponseSchema,
    executeProcessorBodySchema,
    upsertVectorsBodySchema,
    queryVectorsBodySchema,
    timeTravelBodySchema,
    workflowExecutionResultSchema,
    workflowRunResultSchema,
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} contains no z.any()`, () => {
      const defTypes = collectDefTypes(schema);
      expect([...defTypes]).not.toContain('any');
    });
  }

  it('coreMessageSchema is z.unknown()', () => {
    expect((coreMessageSchema as unknown as { def: { type: string } }).def.type).toBe('unknown');
  });

  it('backgroundTaskStreamResponseSchema is z.unknown()', () => {
    expect((backgroundTaskStreamResponseSchema as unknown as { def: { type: string } }).def.type).toBe('unknown');
  });
});

describe('collectDefTypes walker', () => {
  it('finds z.any() hidden behind a z.lazy() getter', () => {
    const lazy = z.lazy(() => z.object({ leaked: z.any() }));
    expect([...collectDefTypes(lazy as unknown as z4.$ZodType)]).toContain('any');
  });

  it('finds z.any() nested in arrays, records, and unions', () => {
    const nested = z.union([z.array(z.record(z.string(), z.object({ deep: z.any() }))), z.string()]);
    expect([...collectDefTypes(nested as unknown as z4.$ZodType)]).toContain('any');
  });

  it('does not report any for a fully unknown-typed schema', () => {
    const clean = z.lazy(() => z.object({ value: z.unknown() }));
    expect([...collectDefTypes(clean as unknown as z4.$ZodType)]).not.toContain('any');
  });
});
