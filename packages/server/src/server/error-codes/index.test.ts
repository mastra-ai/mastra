import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript-classic';
import { describe, expect, it } from 'vitest';
import { SERVER_ERROR_CODES, getServerErrorInfo, isServerErrorCode } from './index';

const HTTP_STATUS_NAMES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'NOT_IMPLEMENTED',
  'BAD_GATEWAY',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
];

describe('SERVER_ERROR_CODES', () => {
  it('maps every key to itself', () => {
    for (const [key, value] of Object.entries(SERVER_ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });

  it('uses UPPER_SNAKE keys', () => {
    for (const key of Object.keys(SERVER_ERROR_CODES)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('never restates a bare HTTP status', () => {
    for (const name of HTTP_STATUS_NAMES) {
      expect(SERVER_ERROR_CODES).not.toHaveProperty(name);
    }
  });
});

describe('isServerErrorCode', () => {
  it('accepts catalog codes only', () => {
    expect(isServerErrorCode('AGENT_NOT_FOUND')).toBe(true);
    expect(isServerErrorCode('NOT_A_CODE')).toBe(false);
    expect(isServerErrorCode('toString')).toBe(false);
    expect(isServerErrorCode(42)).toBe(false);
  });
});

describe('getServerErrorInfo', () => {
  it('reads a catalog code without metadata', () => {
    expect(getServerErrorInfo({ error: 'x', code: 'AGENT_NOT_FOUND' })).toEqual({ code: 'AGENT_NOT_FOUND' });
  });

  it('reads a catalog code with plain-object metadata', () => {
    expect(getServerErrorInfo({ code: 'AGENT_NOT_FOUND', metadata: { agentId: 'a' } })).toEqual({
      code: 'AGENT_NOT_FOUND',
      metadata: { agentId: 'a' },
    });
  });

  it('ignores a missing or foreign code', () => {
    expect(getServerErrorInfo({})).toBeUndefined();
    expect(getServerErrorInfo({ code: 'NOT_FOUND' })).toBeUndefined();
    expect(getServerErrorInfo(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))).toBeUndefined();
  });

  it('drops non-object metadata', () => {
    expect(getServerErrorInfo({ code: 'AGENT_NOT_FOUND', metadata: 'x' })).toEqual({ code: 'AGENT_NOT_FOUND' });
    expect(getServerErrorInfo({ code: 'AGENT_NOT_FOUND', metadata: ['x'] })).toEqual({ code: 'AGENT_NOT_FOUND' });
    expect(getServerErrorInfo({ code: 'AGENT_NOT_FOUND', metadata: null })).toEqual({ code: 'AGENT_NOT_FOUND' });
  });

  it('ignores non-objects', () => {
    expect(getServerErrorInfo(null)).toBeUndefined();
    expect(getServerErrorInfo('AGENT_NOT_FOUND')).toBeUndefined();
  });
});

/** Whether `node` is an object literal with its own top-level `code` property. */
function hasCodeProperty(node: ts.Expression | undefined): boolean {
  return (
    !!node &&
    ts.isObjectLiteralExpression(node) &&
    node.properties.some(
      property =>
        (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
        property.name.getText() === 'code',
    )
  );
}

/** Whether `node` names a parameter of an enclosing function declared as `HandleErrorFallback`. */
function isTypedFallbackParameter(node: ts.Expression | undefined): boolean {
  if (!node || !ts.isIdentifier(node)) return false;
  for (let scope: ts.Node | undefined = node.parent; scope; scope = scope.parent) {
    if (!ts.isFunctionLike(scope)) continue;
    const parameter = scope.parameters.find(p => ts.isIdentifier(p.name) && p.name.text === node.text);
    if (parameter) return parameter.type?.getText() === 'HandleErrorFallback';
  }
  return false;
}

/** Returns each `new HTTPException(...)` and `handleError(...)` call whose options carry no `code`. */
function findUncodedCalls(fileName: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const uncoded: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) && node.expression.getText() === 'HTTPException') {
      if (!hasCodeProperty(node.arguments?.[1])) uncoded.push(node.getText());
    }
    if (ts.isCallExpression(node) && node.expression.getText() === 'handleError') {
      const fallback = node.arguments[1];
      // A wrapper forwarding its `HandleErrorFallback` parameter already has a `code` required by that type.
      if (!isTypedFallbackParameter(fallback) && !hasCodeProperty(fallback)) uncoded.push(node.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return uncoded;
}

describe('built-in server code', () => {
  // `code` is optional for compatibility with custom routes, so built-in throw sites are checked here instead.
  const serverDir = join(__dirname, '..');
  const sources = readdirSync(serverDir, { recursive: true, encoding: 'utf8' })
    .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.'))
    .map(file => ({ file, source: readFileSync(join(serverDir, file), 'utf8') }));

  it('passes a business code to every HTTPException and handleError call', () => {
    const missing = sources.flatMap(({ file, source }) =>
      findUncodedCalls(file, source).map(call => `${file}: ${call.slice(0, 80)}`),
    );
    expect(missing).toEqual([]);
  });

  it('ignores parentheses in strings and `code` outside the options object', () => {
    const source = `
      new HTTPException(400, { message: 'bad )', code: SERVER_ERROR_CODES.AGENT_NOT_FOUND });
      new HTTPException(400, { message: 'missing code' });
      new HTTPException(400, { message: String({ code: 1 }) });
      handleError(error, { message: 'oops (', code: SERVER_ERROR_CODES.AGENT_GET_FAILED });
      handleError(error, 'error code');
      function typed(error: unknown, fallback: HandleErrorFallback) {
        handleError(error, fallback);
      }
      function untyped(error: unknown, fallback: string) {
        handleError(error, fallback);
      }
      const fallback = 'outer string';
      handleError(error, fallback);
    `;
    expect(findUncodedCalls('sample.ts', source)).toEqual([
      "new HTTPException(400, { message: 'missing code' })",
      'new HTTPException(400, { message: String({ code: 1 }) })',
      "handleError(error, 'error code')",
      'handleError(error, fallback)',
      'handleError(error, fallback)',
    ]);
  });
});
