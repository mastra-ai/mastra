import { google } from '@ai-sdk/google-v5';
import { openai } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { isProviderDefinedTool } from '../toolchecks';

describe('isProviderDefinedTool', () => {
  it('should identify Google provider-defined tools', () => {
    expect(isProviderDefinedTool(google.tools.googleSearch({}))).toBe(true);
    expect(isProviderDefinedTool(google.tools.urlContext({}))).toBe(true);
  });

  it('should identify OpenAI provider-defined tools', () => {
    expect(isProviderDefinedTool(openai.tools.webSearch({}))).toBe(true);
  });

  it('should reject null, undefined, and non-objects', () => {
    expect(isProviderDefinedTool(null)).toBe(false);
    expect(isProviderDefinedTool(undefined)).toBe(false);
    expect(isProviderDefinedTool('string')).toBe(false);
    expect(isProviderDefinedTool(42)).toBe(false);
  });

  it('should reject regular tools and plain objects', () => {
    expect(isProviderDefinedTool({})).toBe(false);
    expect(isProviderDefinedTool({ type: 'function', id: 'test' })).toBe(false);
    expect(isProviderDefinedTool({ type: 'provider-defined' })).toBe(false); // missing id
    expect(isProviderDefinedTool({ type: 'provider', id: 123 })).toBe(false); // id not string
  });

  it('should accept both v5 and v6 type markers', () => {
    expect(isProviderDefinedTool({ type: 'provider-defined', id: 'google.search' })).toBe(true);
    expect(isProviderDefinedTool({ type: 'provider', id: 'openai.web_search' })).toBe(true);
  });
});
