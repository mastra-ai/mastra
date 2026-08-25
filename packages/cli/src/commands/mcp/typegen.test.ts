import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTypegenResult, resolveTypegenOutputPath } from './typegen';
import { TYPEGEN_RESULT_MARKER } from './TypegenBundler';

describe('parseTypegenResult', () => {
  it('parses the marker-prefixed JSON line', () => {
    const stdout = ['some server log', `${TYPEGEN_RESULT_MARKER}{"success":true,"code":"export {}\\n"}`, ''].join('\n');
    expect(parseTypegenResult(stdout)).toEqual({ success: true, code: 'export {}\n' });
  });

  it('uses the last marker line when multiple are present', () => {
    const stdout = [
      `${TYPEGEN_RESULT_MARKER}{"success":false,"message":"first"}`,
      `${TYPEGEN_RESULT_MARKER}{"success":true,"code":"x"}`,
    ].join('\n');
    expect(parseTypegenResult(stdout)).toEqual({ success: true, code: 'x' });
  });

  it('ignores generated code containing braces on other lines', () => {
    const stdout = [
      '{"success":true,"code":"decoy"}',
      'export interface Foo { "success": string }',
      `${TYPEGEN_RESULT_MARKER}{"success":true,"code":"real"}`,
    ].join('\n');
    expect(parseTypegenResult(stdout)).toEqual({ success: true, code: 'real' });
  });

  it('returns undefined when no marker line exists', () => {
    expect(parseTypegenResult('random output\n{"success":true}')).toBeUndefined();
  });

  it('returns undefined for a malformed marker payload', () => {
    expect(parseTypegenResult(`${TYPEGEN_RESULT_MARKER}not-json`)).toBeUndefined();
  });
});

describe('resolveTypegenOutputPath', () => {
  const rootDir = join('/tmp', 'project');
  const mastraDir = join(rootDir, 'src', 'mastra');

  it('defaults to mcp-tools.generated.ts in the mastra dir', () => {
    expect(resolveTypegenOutputPath({ rootDir, mastraDir })).toBe(join(mastraDir, 'mcp-tools.generated.ts'));
  });

  it('resolves a relative --output against the project root', () => {
    expect(resolveTypegenOutputPath({ rootDir, mastraDir, output: join('types', 'mcp.ts') })).toBe(
      join(rootDir, 'types', 'mcp.ts'),
    );
  });

  it('keeps an absolute --output as-is', () => {
    const absolute = join('/tmp', 'elsewhere', 'mcp.ts');
    expect(resolveTypegenOutputPath({ rootDir, mastraDir, output: absolute })).toBe(absolute);
  });
});
