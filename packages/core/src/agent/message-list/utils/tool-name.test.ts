/**
 * Tests for packages/core/src/agent/message-list/utils/tool-name.ts
 *
 * `sanitizeToolName` is a pure function with no I/O and no async behaviour.
 * It guards against unsafe/unexpected tool-name values before they are used
 * downstream (e.g. as identifiers in provider-specific tool-call payloads).
 */
import { describe, expect, it } from 'vitest';

import { FALLBACK_TOOL_NAME, sanitizeToolName } from './tool-name';

describe('sanitizeToolName', () => {
  it('returns the input unchanged when it only contains allowed characters', () => {
    expect(sanitizeToolName('getWeather')).toBe('getWeather');
    expect(sanitizeToolName('get_weather')).toBe('get_weather');
    expect(sanitizeToolName('get-weather')).toBe('get-weather');
    expect(sanitizeToolName('getWeather123')).toBe('getWeather123');
  });

  it('accepts a name made purely of digits', () => {
    expect(sanitizeToolName('12345')).toBe('12345');
  });

  it('accepts a name made purely of underscores and hyphens', () => {
    expect(sanitizeToolName('___')).toBe('___');
    expect(sanitizeToolName('---')).toBe('---');
  });

  it('falls back for names containing spaces', () => {
    expect(sanitizeToolName('get weather')).toBe(FALLBACK_TOOL_NAME);
  });

  it('falls back for names containing dots', () => {
    expect(sanitizeToolName('weather.get')).toBe(FALLBACK_TOOL_NAME);
  });

  it('falls back for names containing special/unsafe characters', () => {
    expect(sanitizeToolName('get<weather>')).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName('weather;DROP TABLE')).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName('weather/forecast')).toBe(FALLBACK_TOOL_NAME);
  });

  it('falls back for an empty string', () => {
    expect(sanitizeToolName('')).toBe(FALLBACK_TOOL_NAME);
  });

  it('falls back for non-string inputs', () => {
    expect(sanitizeToolName(undefined)).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName(null)).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName(123)).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName({})).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName([])).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName(true)).toBe(FALLBACK_TOOL_NAME);
  });

  it('falls back for unicode/emoji tool names', () => {
    expect(sanitizeToolName('☃️toolName')).toBe(FALLBACK_TOOL_NAME);
    expect(sanitizeToolName('工具名')).toBe(FALLBACK_TOOL_NAME);
  });

  it('is case sensitive but accepts both cases', () => {
    expect(sanitizeToolName('GetWeather')).toBe('GetWeather');
    expect(sanitizeToolName('GETWEATHER')).toBe('GETWEATHER');
    expect(sanitizeToolName('getweather')).toBe('getweather');
  });

  it('exposes FALLBACK_TOOL_NAME as the documented sentinel value', () => {
    expect(FALLBACK_TOOL_NAME).toBe('unknown_tool');
  });
});
