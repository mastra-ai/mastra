import { describe, expect, it } from 'vitest';
import { thinkingRequestFor } from '../thinking-request.js';

describe('thinkingRequestFor', () => {
  it('sends no thinking switch to a model that lists none, leaving it on its default', () => {
    const request = thinkingRequestFor('deepseek/deepseek-v4-pro', [{ type: 'effort', values: ['medium'] }]);
    expect(request?.optionsByLevel.has('high')).toBe(true);
    expect(request?.optionsByLevel.get('high')).toBeUndefined();
  });
});
