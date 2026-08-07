import { describe, expect, it } from 'vitest';

import { consumeBuilderValidatedInput, markBuilderValidatedInput } from './builder-validation-context';
import * as tools from './index';

describe('builder validation context', () => {
  it('does not expose validation bypass helpers from the public tools entrypoint', () => {
    expect(tools).not.toHaveProperty('markBuilderValidatedInput');
    expect(tools).not.toHaveProperty('consumeBuilderValidatedInput');
  });

  it('consumes builder validation state once', () => {
    const context = {};

    expect(consumeBuilderValidatedInput(context)).toBe(false);

    markBuilderValidatedInput(context);

    expect(consumeBuilderValidatedInput(context)).toBe(true);
    expect(consumeBuilderValidatedInput(context)).toBe(false);
  });
});
