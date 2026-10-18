import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { toStandardSchema } from '../../schema';
import type { StandardSchemaWithJSON } from '../../schema';
import { createTool } from '../tool';
import type { ToolAction } from '../types';
import { CoreToolBuilder } from './builder';

type ValidateResult =
  | { success: true; value: unknown }
  | { success: false; error: Error & { errors?: { path: string[]; message: string }[] } };

function getValidate(tool: ToolAction<any, any>) {
  const coreTool = new CoreToolBuilder({
    originalTool: tool,
    options: { name: 'save_items', requestContext: new RequestContext() },
  }).build();
  const validate = (coreTool.parameters as { validate?: (value: unknown) => ValidateResult | Promise<ValidateResult> })
    .validate;
  expect(validate).toBeTypeOf('function');
  return validate!;
}

const inputSchema = z.object({
  items: z.array(z.object({ tags: z.array(z.string()) })),
  options: z.object({ destination: z.string() }),
});

const invalidInput = { items: [{ tags: 'example' }], options: {} };

function expectPathAwareFailure(result: ValidateResult) {
  expect(result.success).toBe(false);
  if (result.success) return;

  expect(result.error.errors).toEqual([
    { path: ['items', '0', 'tags'], message: expect.stringContaining('expected array') },
    { path: ['options', 'destination'], message: expect.stringContaining('expected string') },
  ]);
  expect(result.error.message).toMatch(/^- items\.0\.tags: .*expected array/m);
  expect(result.error.message).toMatch(/^- options\.destination: .*expected string/m);
}

describe('CoreToolBuilder - Standard Schema validation error paths', () => {
  it('preserves nested field paths for synchronous validation failures', () => {
    const tool = createTool({ id: 'save_items', description: 'Save items', inputSchema, execute: async () => ({}) });
    const result = getValidate(tool)(invalidInput);

    expect(result).not.toBeInstanceOf(Promise);
    expectPathAwareFailure(result as ValidateResult);
  });

  it('preserves nested field paths for asynchronous validation failures', async () => {
    const standard = toStandardSchema(inputSchema);
    const asyncSchema: StandardSchemaWithJSON = {
      '~standard': { ...standard['~standard'], validate: async value => standard['~standard'].validate(value) },
    };
    const tool = createTool({
      id: 'save_items',
      description: 'Save items',
      inputSchema: asyncSchema,
      execute: async () => ({}),
    });
    const result = getValidate(tool)(invalidInput);

    expect(result).toBeInstanceOf(Promise);
    expectPathAwareFailure(await result);
  });

  it('reports root-level issues as root', () => {
    const tool = createTool({ id: 'save_items', description: 'Save items', inputSchema, execute: async () => ({}) });
    const result = getValidate(tool)('not an object') as ValidateResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.errors).toEqual([{ path: [], message: expect.stringContaining('expected object') }]);
    expect(result.error.message).toMatch(/^- root: /);
  });

  it('passes valid input through unchanged', () => {
    const tool = createTool({ id: 'save_items', description: 'Save items', inputSchema, execute: async () => ({}) });
    const value = { items: [{ tags: ['example'] }], options: { destination: 'local' } };

    expect(getValidate(tool)(value)).toEqual({ success: true, value });
  });
});
