import { describe, expect, it } from 'vitest';

import { parseModelRouterId } from './gateway-resolver';

describe('parseModelRouterId', () => {
  it('parses an Azure OpenAI deployment name', () => {
    expect(parseModelRouterId('azure-openai/my-deployment', 'azure-openai')).toEqual({
      providerId: 'azure-openai',
      modelId: 'my-deployment',
    });
  });

  it('rejects an empty Azure OpenAI deployment name', () => {
    expect(() => parseModelRouterId('azure-openai/', 'azure-openai')).toThrow(
      'Expected format azure-openai/deployment-name, but got azure-openai/',
    );
  });
});
