---
'@internal/test-utils': minor
---

Added `createLLMMock(model)` for recording/replaying LLM API calls in tests. Pass any AI SDK model instance — the mock reads `provider` and `modelId` for naming. No global state.

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { createLLMMock } from '@internal/test-utils';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || 'test-key' });

describe('my agent', () => {
  const mock = createLLMMock(openai('gpt-4o'));
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  it('generates a response', async () => {
    const result = await agent.generate('Hello');
    expect(result.text).toBeDefined();
  });
});
```
