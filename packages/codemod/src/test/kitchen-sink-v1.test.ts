import { describe, it } from 'vitest';
import { testUpgrade } from './test-utils';

describe('kitchen-sink-v1', () => {
  it('transforms correctly with all v1 codemods', async () => {
    await testUpgrade('v1', 'kitchen-sink-v1');
  });
});
