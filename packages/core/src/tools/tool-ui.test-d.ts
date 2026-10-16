import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from './tool';
import type { ToolStudioComponentProps } from './types';

describe('createTool ui.studioComponent', () => {
  const inputSchema = z.object({ city: z.string() });
  const outputSchema = z.object({ temperature: z.number() });

  it('infers studio component props from the input and output schemas', () => {
    createTool({
      id: 'weather',
      description: 'Get the weather',
      inputSchema,
      outputSchema,
      execute: async () => ({ temperature: 20 }),
      ui: {
        studioComponent: props => {
          expectTypeOf(props.input).toEqualTypeOf<{ city: string } | undefined>();
          expectTypeOf(props.output).toEqualTypeOf<{ temperature: number } | undefined>();
          expectTypeOf(props.toolCallId).toEqualTypeOf<string>();
          return null;
        },
      },
    });
  });

  it('accepts a component declared with matching props', () => {
    const WeatherCard = (_props: ToolStudioComponentProps<{ city: string }, { temperature: number }>) => null;

    createTool({
      id: 'weather',
      description: 'Get the weather',
      inputSchema,
      outputSchema,
      execute: async () => ({ temperature: 20 }),
      ui: { studioComponent: WeatherCard },
    });
  });

  it('rejects a component whose props do not match the schemas', () => {
    const WrongCard = (_props: ToolStudioComponentProps<{ zip: number }>) => null;

    createTool({
      id: 'weather',
      description: 'Get the weather',
      inputSchema,
      outputSchema,
      execute: async () => ({ temperature: 20 }),
      // @ts-expect-error input shape does not match the input schema
      ui: { studioComponent: WrongCard },
    });
  });
});
