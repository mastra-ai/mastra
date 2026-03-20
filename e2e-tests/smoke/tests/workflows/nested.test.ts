import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('nested workflows', () => {
  it('should execute inner workflow as a step and pass data through', async () => {
    const { data } = await startWorkflow('outer-workflow', {
      inputData: { input: 'hello' },
    });

    expect(data.status).toBe('success');
    expect(data.result).toEqual({ final: '[PROCESSED:HELLO]' });
  });
});
