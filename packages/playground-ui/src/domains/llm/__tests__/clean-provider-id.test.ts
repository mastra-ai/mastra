import { describe, it, expect } from 'vitest';
import { cleanProviderId } from '../clean-provider-id';

describe('cleanProviderId', () => {
  it('should remove .chat suffix', () => {
    expect(cleanProviderId('openai.chat')).toBe('openai');
  });

  it('should remove .messages suffix', () => {
    expect(cleanProviderId('anthropic.messages')).toBe('anthropic');
  });

  it('should remove .responses suffix', () => {
    expect(cleanProviderId('openai.responses')).toBe('openai');
  });

  it('should return unchanged if no dot suffix', () => {
    expect(cleanProviderId('openai')).toBe('openai');
  });

  it('should return unchanged for gateway/provider format', () => {
    expect(cleanProviderId('acme/custom')).toBe('acme/custom');
  });
});
