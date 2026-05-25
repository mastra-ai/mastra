import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from './tool';
import type { InferToolInput, InferToolOutput, InferUITool, InferUITools } from './ui-types';

describe('InferUITools — concrete outputSchema', () => {
  const echoTool = createTool({
    id: 'echo',
    description: 'echo the input back',
    inputSchema: z.object({ x: z.string() }),
    outputSchema: z.object({ y: z.number() }),
    execute: async ({ x }) => ({ y: x.length }),
  });

  const noOutputTool = createTool({
    id: 'no-output',
    description: 'tool without a declared output schema',
    inputSchema: z.object({ q: z.string() }),
    execute: async ({ q }) => ({ q }),
  });

  const tools = { echo: echoTool, noOutput: noOutputTool };

  it('infers concrete input for tools with a typed outputSchema', () => {
    expectTypeOf<InferToolInput<typeof echoTool>>().toEqualTypeOf<{ x: string }>();
  });

  it('infers concrete output for tools with a typed outputSchema', () => {
    expectTypeOf<InferToolOutput<typeof echoTool>>().toEqualTypeOf<{ y: number }>();
  });

  it('infers input for tools without an outputSchema', () => {
    expectTypeOf<InferToolInput<typeof noOutputTool>>().toEqualTypeOf<{ q: string }>();
  });

  it('InferUITool projects a concrete tool into `{ input, output }`', () => {
    type EchoUITool = InferUITool<typeof echoTool>;
    expectTypeOf<EchoUITool['input']>().toEqualTypeOf<{ x: string }>();
    expectTypeOf<EchoUITool['output']>().toEqualTypeOf<{ y: number }>();
  });

  it('InferUITools maps a tool set without collapsing entries to `never`', () => {
    type UITools = InferUITools<typeof tools>;
    expectTypeOf<UITools['echo']['input']>().toEqualTypeOf<{ x: string }>();
    expectTypeOf<UITools['echo']['output']>().toEqualTypeOf<{ y: number }>();
    expectTypeOf<UITools['noOutput']['input']>().toEqualTypeOf<{ q: string }>();
  });
});
