import { beforeEach, describe, it, expect } from '@jest/globals';

import { Mastra } from '../mastra';

import { TestIntegration } from './integration.mock';

describe('add integration', () => {
  let mastra: any;

  beforeEach(() => {
    mastra = new Mastra({
      integrations: [new TestIntegration()],
    });
  });

  it('should contain the new integration', async () => {
    const int = mastra.getIntegration('TEST');

    expect(int).toBeDefined();
  });

  it('should return the correct integration name, logoUrl, categories and description', async () => {
    const int = mastra.getIntegration('TEST');
    const name = int.name;
    const logoUrl = int.logoUrl;
    const categories = int.categories;
    const description = int.description;

    expect(name).toBe('TEST');
    expect(logoUrl).toBe('/logo-url');
    expect(categories).toStrictEqual(['test-integration']);
    expect(description).toBe('This is a test integration');
  });

  it('should contain testTool tool in the test integration', async () => {
    const int = mastra.getIntegration('TEST');
    const tools = int.tools;
    const testTool = tools.testTool;
    const toolLabel = testTool.label;

    expect(testTool).toBeDefined();
    expect(toolLabel).toBe('Test integration tool');
  });
});
