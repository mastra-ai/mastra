import { describe, it, expect } from 'vitest';
import { startWorkflow } from '../utils.js';

describe('sleep workflows', () => {
  it('should complete after a 2s sleep and report elapsed time', async () => {
    const { data } = await startWorkflow('sleep-workflow', {
      inputData: { label: 'sleep-test' },
    });

    expect(data.status).toBe('success');
    expect(data.result.label).toBe('sleep-test');
    // Sleep was 2000ms — allow some tolerance
    expect(data.result.sleptMs).toBeGreaterThanOrEqual(1500);
    expect(data.result.sleptMs).toBeLessThan(10000);
  });
});
