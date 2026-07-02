import { describe, expect, it } from 'vitest';
import {
  collectEnvironmentVariables,
  normalizeEnvironmentVariables,
  rowsFromEnvironmentVariables,
} from './environment-variables';

describe('desktop runtime environment variables', () => {
  it('keeps valid environment variable names and stringifies values', () => {
    expect(
      normalizeEnvironmentVariables({
        ' BAD KEY ': 'ignored',
        LM_API_TOKEN: 'lm-secret',
        OPENAI_API_KEY: 123,
      }),
    ).toEqual({
      LM_API_TOKEN: 'lm-secret',
      OPENAI_API_KEY: '123',
    });
  });

  it('creates one empty row when there are no saved variables', () => {
    expect(rowsFromEnvironmentVariables({})).toEqual([{ key: '', value: '' }]);
  });

  it('collects editor rows and rejects duplicate keys', () => {
    expect(
      collectEnvironmentVariables([
        { key: ' OPENAI_API_KEY ', value: 'sk-local' },
        { key: '', value: 'ignored' },
      ]),
    ).toEqual({
      OPENAI_API_KEY: 'sk-local',
    });

    expect(() =>
      collectEnvironmentVariables([
        { key: 'LM_API_TOKEN', value: 'one' },
        { key: 'LM_API_TOKEN', value: 'two' },
      ]),
    ).toThrow('Environment variable "LM_API_TOKEN" is duplicated.');
  });
});
