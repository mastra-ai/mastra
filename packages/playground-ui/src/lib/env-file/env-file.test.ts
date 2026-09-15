// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE,
  DuplicateEnvironmentVariableKeyError,
  ENV_FILE_MAX_SIZE,
  collectEnvironmentVariables,
  createEmptyEnvironmentVariableEntry,
  getDuplicateEnvironmentVariableKeys,
  parseEnvFileText,
  readEnvFile,
  rowsFromEnvironmentVariables,
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
      error: 'File appears to be binary. Please import a plain-text .env file.',
    });

    await expect(readEnvFile(new File(['too large'], '.env'), { maxSize: 2 })).resolves.toEqual({
      ok: false,
      error: 'File is too large (max 1 KB).',
    });
  });

  it('skips lines that carry no assignment', () => {
    expect(parseEnvFileText('JUST_A_WORD\n=novalue\n   =spaced\nGOOD=1')).toEqual([{ key: 'GOOD', value: '1' }]);
  });

  it('keeps an unterminated quoted value up to the end of the file', () => {
    expect(parseEnvFileText('KEY="never closed\nsecond line')).toEqual([
      { key: 'KEY', value: 'never closed\nsecond line' },
    ]);
  });

  it('counts backslashes to decide whether a quote closes the value', () => {
    // An even run of backslashes leaves the quote unescaped, so it closes.
    expect(parseEnvFileText(String.raw`KEY="ends with a slash\\"` + '\nAFTER=1')).toEqual([
      { key: 'KEY', value: 'ends with a slash\\' },
      { key: 'AFTER', value: '1' },
    ]);
  });

  it('leaves an unknown escape sequence alone', () => {
    expect(parseEnvFileText(String.raw`KEY="keep \q as-is"`)).toEqual([
      { key: 'KEY', value: String.raw`keep \q as-is` },
    ]);
  });

  it('reads an escaped quote as content rather than the end of the value', () => {
    // The `\'` does not close the value, so the parser runs on to the end of the file.
    expect(parseEnvFileText(String.raw`KEY='ends with \'`)).toEqual([{ key: 'KEY', value: "ends with '" }]);
  });

  it('keeps a backslash that has nothing left to escape', () => {
    expect(parseEnvFileText('KEY="ends with a backslash\\')).toEqual([
      { key: 'KEY', value: 'ends with a backslash\\' },
    ]);
  });

  it('quotes a value carrying a carriage return', () => {
    expect(rowsToEnvFileText([{ key: 'CR', value: 'one\rtwo' }])).toBe('CR="one\rtwo"');
  });

  it('skips rows with a blank key when serializing', () => {
    expect(
      rowsToEnvFileText([
        { key: '  ', value: 'ignored' },
        { key: ' KEEP ', value: '1' },
      ]),
    ).toBe('KEEP=1');
  });

  it('serializes an empty row list to an empty string', () => {
    expect(rowsToEnvFileText([])).toBe('');
  });

  it('names the duplicated key on the error it throws', () => {
    const error = new DuplicateEnvironmentVariableKeyError('API_KEY');

    expect(error.key).toBe('API_KEY');
    expect(error.name).toBe('DuplicateEnvironmentVariableKeyError');
    expect(error.message).toBe(DUPLICATE_ENVIRONMENT_VARIABLE_MESSAGE);
  });

  it('ignores blank keys when reporting duplicates', () => {
    expect([
      ...getDuplicateEnvironmentVariableKeys([
        { key: ' ', value: '1' },
        { key: '', value: '2' },
      ]),
    ]).toEqual([]);
    // Keys are compared trimmed, so these two collide.
    expect([
      ...getDuplicateEnvironmentVariableKeys([
        { key: 'A', value: '1' },
        { key: ' A ', value: '2' },
      ]),
    ]).toEqual(['A']);
  });

  it('starts an editor row empty', () => {
    expect(createEmptyEnvironmentVariableEntry()).toEqual({ key: '', value: '' });
  });

  describe('rowsFromEnvironmentVariables', () => {
    it('renders one row per variable, stringifying the values', () => {
      expect(rowsFromEnvironmentVariables({ A: 1, B: null, C: 'text' })).toEqual([
        { key: 'A', value: '1' },
        { key: 'B', value: 'null' },
        { key: 'C', value: 'text' },
      ]);
    });

    it('always leaves one blank row to type into', () => {
      expect(rowsFromEnvironmentVariables(undefined)).toEqual([{ key: '', value: '' }]);
      expect(rowsFromEnvironmentVariables({})).toEqual([{ key: '', value: '' }]);
    });
  });

  it('accepts a file that is exactly at the size limit', async () => {
    await expect(readEnvFile(new File(['A=1'], '.env'), { maxSize: 3 })).resolves.toEqual({
      ok: true,
      entries: [{ key: 'A', value: '1' }],
    });
  });

  it('defaults to a 64 KB limit', async () => {
    expect(ENV_FILE_MAX_SIZE).toBe(64 * 1024);

    await expect(readEnvFile(new File(['A='.padEnd(ENV_FILE_MAX_SIZE + 1, 'x')], '.env'))).resolves.toEqual({
      ok: false,
      error: 'File is too large (max 64 KB).',
    });
  });

  it('reports a file it cannot read', async () => {
    const unreadable = {
      size: 10,
      text: () => Promise.reject(new Error('nope')),
    } as unknown as File;

    await expect(readEnvFile(unreadable)).resolves.toEqual({
      ok: false,
      error: 'Could not read the selected file. Please try again.',
    });
  });

  it('refuses a file that holds binary content', async () => {
    await expect(readEnvFile(new File(['A=1\0B=2'], '.env'))).resolves.toEqual({
      ok: false,
      error: 'File appears to be binary. Please import a plain-text .env file.',
    });
  });

  it('refuses a file that assigns nothing at all', async () => {
    await expect(readEnvFile(new File(['# only a comment\n\n'], '.env'))).resolves.toEqual({
      ok: false,
      error: 'No valid environment variables found in the file.',
    });
  });

  it('strips a byte order mark only at the very start', () => {
    expect(parseEnvFileText('\uFEFFKEY=value')).toEqual([{ key: 'KEY', value: 'value' }]);
    // Without a leading mark there is nothing to strip: one inside a value is content.
    expect(parseEnvFileText('KEY=a\uFEFFb')).toEqual([{ key: 'KEY', value: 'a\uFEFFb' }]);
  });

  it('only treats a leading hash as a comment', () => {
    expect(parseEnvFileText('KEY=value#\nOTHER=1')).toEqual([
      { key: 'KEY', value: 'value#' },
      { key: 'OTHER', value: '1' },
    ]);
  });

  it('ignores a comment even when it contains an assignment', () => {
    expect(parseEnvFileText('# KEY=commented out\nREAL=1')).toEqual([{ key: 'REAL', value: '1' }]);
  });

  it('ignores an indented comment that contains an assignment', () => {
    expect(parseEnvFileText('   # KEY=commented out\nREAL=1')).toEqual([{ key: 'REAL', value: '1' }]);
  });

  it('only strips an export prefix at the start of the line', () => {
    expect(parseEnvFileText('KEY=export value')).toEqual([{ key: 'KEY', value: 'export value' }]);
  });

  it('closes a multi-line value on the first unescaped quote of a later line', () => {
    // The continuation line opens with an escaped quote, which is content.
    expect(parseEnvFileText('KEY="first\n\\"still inside"\nAFTER=1')).toEqual([
      { key: 'KEY', value: 'first\n"still inside' },
      { key: 'AFTER', value: '1' },
    ]);
  });

  it('unescapes a doubled backslash inside a single-quoted value', () => {
    expect(parseEnvFileText(String.raw`KEY='a\\b'`)).toEqual([{ key: 'KEY', value: String.raw`a\b` }]);
  });

  it('escapes backslashes when it has to quote a value', () => {
    expect(rowsToEnvFileText([{ key: 'KEY', value: 'a\\b\nc' }])).toBe('KEY="a\\\\b\nc"');
  });

  it('leaves a value with only inner spaces unquoted', () => {
    expect(rowsToEnvFileText([{ key: 'KEY', value: 'a b c' }])).toBe('KEY=a b c');
  });
});
