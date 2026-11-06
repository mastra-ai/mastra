import { expectTypeOf, test } from 'vitest';
import { z } from 'zod/v4';
import type { MastraClient } from '../src/client';

declare const client: MastraClient;

const sentiment = z.object({ sentiment: z.enum(['positive', 'negative']), confidence: z.number() });

// #29604: the `output` and `experimental_output` overloads returned `GenerateReturn<any, any, any>`,
// which typed `object` as `never` and dropped `text`
test('agent.generateLegacy infers object from output and keeps text with experimental_output', async () => {
  const agent = client.getAgent('support');

  const withOutput = await agent.generateLegacy({ messages: 'Classify', output: sentiment });
  expectTypeOf(withOutput.object).toEqualTypeOf<{ sentiment: 'positive' | 'negative'; confidence: number }>();

  const withExperimental = await agent.generateLegacy({ messages: 'Classify', experimental_output: sentiment });
  expectTypeOf(withExperimental.text).toBeString();
  expectTypeOf(withExperimental.object).toEqualTypeOf<
    { sentiment: 'positive' | 'negative'; confidence: number } | undefined
  >();
});
