// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  DuplicateEnvironmentVariableKeyError,
  collectEnvironmentVariables,
  getDuplicateEnvironmentVariableKeys,
  parseEnvFileText,
  readEnvFile,
  rowsToEnvFileText,
} from './env-file';

describe('env file utilities', () => {
  it('parses comments, exports, quoted values, values containing equals, and multiline values', () => {
    expect(
      parseEnvFileText(`
# comment
export PUBLIC_URL=https://example.com
TOKEN="abc=123"
PRIVATE_KEY="-----BEGIN
line two
-----END"
SINGLE='quoted value'
PLAIN=value # inline comment
`),
    ).toEqual([
      { key: 'PUBLIC_URL', value: 'https://example.com' },
      { key: 'TOKEN', value: 'abc=123' },
      { key: 'PRIVATE_KEY', value: '-----BEGIN\nline two\n-----END' },
      { key: 'SINGLE', value: 'quoted value' },
      { key: 'PLAIN', value: 'value' },
    ]);
  });

  it('parses BOM, CRLF, empty values, spaces around equals, hashes, and flexible export syntax', () => {
    expect(
      parseEnvFileText(
        '\uFEFFexport\tEMPTY=\r\nSPACED = value with spaces \r\nHASH=abc#123\r\nCOMMENTED=abc # remove me\r\nEMPTY_COMMENT= # remove me too\r\n',
      ),
    ).toEqual([
      { key: 'EMPTY', value: '' },
      { key: 'SPACED', value: 'value with spaces' },
      { key: 'HASH', value: 'abc#123' },
      { key: 'COMMENTED', value: 'abc' },
      { key: 'EMPTY_COMMENT', value: '' },
    ]);
  });

  it('parses quoted values when whitespace follows the equals sign', () => {
    expect(
      parseEnvFileText(`
DOUBLE = "quoted value" # trailing comment
SINGLE = 'quoted # value'
MULTILINE = "line one
line two"
`),
    ).toEqual([
      { key: 'DOUBLE', value: 'quoted value' },
      { key: 'SINGLE', value: 'quoted # value' },
      { key: 'MULTILINE', value: 'line one\nline two' },
    ]);
  });

  it('unescapes common double-quoted values without changing single-quoted literal sequences', () => {
    expect(
      parseEnvFileText(String.raw`
DOUBLE="line one\nline two\tTabbed\rReturn"
SINGLE='line one\nline two'
ESCAPED="quote \" and slash \\"
`),
    ).toEqual([
      { key: 'DOUBLE', value: 'line one\nline two\tTabbed\rReturn' },
      { key: 'SINGLE', value: String.raw`line one\nline two` },
      { key: 'ESCAPED', value: 'quote " and slash \\' },
    ]);
  });

  it('serializes multiline values as escaped double-quoted entries', () => {
    expect(
      rowsToEnvFileText([
        { key: 'TOKEN', value: 'abc123' },
        { key: 'PRIVATE_KEY', value: 'line "one"\nline two' },
      ]),
    ).toBe('TOKEN=abc123\nPRIVATE_KEY="line \\"one\\"\nline two"');
  });

  it('serializes values that would otherwise lose significant spaces or comments', () => {
    expect(
      rowsToEnvFileText([
        { key: 'LEADING', value: ' keep' },
        { key: 'TRAILING', value: 'keep ' },
        { key: 'INLINE_COMMENT', value: 'abc # not a comment' },
      ]),
    ).toBe('LEADING=" keep"\nTRAILING="keep "\nINLINE_COMMENT="abc # not a comment"');
  });

  it('collects trimmed keys, skips empty rows, and rejects duplicates', () => {
    expect(
      collectEnvironmentVariables([
        { key: ' PUBLIC_URL ', value: 'https://example.com' },
        { key: '', value: 'ignored' },
      ]),
    ).toEqual({ PUBLIC_URL: 'https://example.com' });

    expect(() =>
      collectEnvironmentVariables([
        { key: 'API_KEY', value: 'one' },
        { key: 'API_KEY', value: 'two' },
      ]),
    ).toThrow(DuplicateEnvironmentVariableKeyError);
  });

  it('returns every duplicated key', () => {
    expect(
      [
        ...getDuplicateEnvironmentVariableKeys([
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
          { key: 'A', value: '3' },
          { key: 'B', value: '4' },
        ]),
      ].sort(),
    ).toEqual(['A', 'B']);
  });

  it('reads valid text env files and rejects invalid uploads', async () => {
    const validFile = new File(['A=1\nB=2'], '.env', { type: 'text/plain' });
    await expect(readEnvFile(validFile)).resolves.toEqual({
      ok: true,
      entries: [
        { key: 'A', value: '1' },
        { key: 'B', value: '2' },
      ],
    });

    await expect(readEnvFile(new File([''], '.env'), { maxSize: 10 })).resolves.toEqual({
      ok: false,
      error: 'No valid environment variables found in the file.',
    });

    await expect(readEnvFile(new File(['\0'], '.env'), { maxSize: 10 })).resolves.toEqual({
      ok: false,
      error: 'File appears to be binary. Please upload a plain-text .env file.',
    });

    await expect(readEnvFile(new File(['too large'], '.env'), { maxSize: 2 })).resolves.toEqual({
      ok: false,
      error: 'File is too large (max 1 KB).',
    });
  });
});
