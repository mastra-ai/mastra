import { describe, it, expect } from 'vitest';
import { MASTRA_USER_AGENT } from './constants.js';

describe('MASTRA_USER_AGENT', () => {
  it('should be defined', () => {
    expect(MASTRA_USER_AGENT).toBeDefined();
  });

  it('should contain "mastra"', () => {
    expect(MASTRA_USER_AGENT).toContain('mastra');
  });
});
