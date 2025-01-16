import { beforeEach, describe, it, expect } from 'vitest';

import { TestIntegration } from './openapi-toolset.mock';

describe('add integration', () => {
  let int: any;

  beforeEach(() => {
    int = new TestIntegration();
  });

  it('should contain the new integration', async () => {
    expect(int).toBeDefined();
  });

  it('should contain testTool tool in the test integration', async () => {
    const testTool = int.getStaticTools()['testTool'];
    const toolLabel = testTool.id;

    expect(testTool).toBeDefined();
    expect(toolLabel).toBe('Test integration tool');
  });
});
