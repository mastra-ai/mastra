import { describe, expect, it } from 'vitest';
import { resolveTemplate, traverseMappingPath, validateTemplate } from '../mapping-template';

/** Minimal fake of the slice of the execute context resolveTemplate reads. */
function makeCtx(overrides: Record<string, any> = {}) {
  return {
    inputData: { name: 'Berlin', temp: 21, nested: { deep: 'value' } },
    getInitData: () => ({ city: 'Berlin' }),
    state: { phase: 'draft' },
    requestContext: { get: (key: string) => ({ userId: 'u-1' })[key as 'userId'] },
    getStepResult: (_stepId: string) => null,
    ...overrides,
  } as any;
}

describe('validateTemplate', () => {
  it('accepts placeholders in every known namespace', () => {
    expect(() =>
      validateTemplate(
        '${inputData.a} ${initData.b} ${state.c} ${requestContext.key} ${stepResults.stepA} ${stepResults.stepA.path}',
      ),
    ).not.toThrow();
  });

  it('accepts strings without placeholders', () => {
    expect(() => validateTemplate('no placeholders here')).not.toThrow();
  });

  it('throws on empty placeholders', () => {
    expect(() => validateTemplate('x ${} y')).toThrow(/empty or whitespace-padded/);
  });

  it('throws on whitespace-padded placeholders', () => {
    expect(() => validateTemplate('${ inputData.a }')).toThrow(/empty or whitespace-padded/);
  });

  it('throws on unknown namespaces', () => {
    expect(() => validateTemplate('${foo.bar}')).toThrow(/unknown namespace "foo"/);
  });

  it('throws on stepResults without a step id', () => {
    expect(() => validateTemplate('${stepResults}')).toThrow(/stepResults\.<stepId>/);
    expect(() => validateTemplate('${stepResults.}')).toThrow(/stepResults\.<stepId>/);
  });

  it('throws on requestContext without a key', () => {
    expect(() => validateTemplate('${requestContext}')).toThrow(/requires a request-context key/);
  });
});

describe('resolveTemplate', () => {
  it('resolves inputData, initData, state and requestContext scopes', () => {
    expect(
      resolveTemplate(
        'City=${initData.city} name=${inputData.name} phase=${state.phase} user=${requestContext.userId}',
        makeCtx(),
      ),
    ).toBe('City=Berlin name=Berlin phase=draft user=u-1');
  });

  it('resolves dotted sub-paths', () => {
    expect(resolveTemplate('${inputData.nested.deep}', makeCtx())).toBe('value');
  });

  it('resolves stepResults with and without a sub-path', () => {
    const ctx = makeCtx({ getStepResult: () => ({ text: 'hello', meta: { n: 2 } }) });
    expect(resolveTemplate('${stepResults.stepA.text}', ctx)).toBe('hello');
    expect(resolveTemplate('${stepResults.stepA.meta.n}', ctx)).toBe('2');
    expect(resolveTemplate('${stepResults.stepA}', ctx)).toBe('{"text":"hello","meta":{"n":2}}');
  });

  it('throws when the referenced step has no successful output', () => {
    expect(() => resolveTemplate('${stepResults.missing}', makeCtx())).toThrow(/has no successful output/);
  });

  it('throws when a path traverses into a non-object', () => {
    expect(() => resolveTemplate('${inputData.name.oops}', makeCtx())).toThrow(/Invalid path/);
  });

  it('JSON-encodes object values and renders null/undefined as empty', () => {
    const ctx = makeCtx({ inputData: { obj: { a: 1 }, nil: null } });
    expect(resolveTemplate('${inputData.obj}', ctx)).toBe('{"a":1}');
    expect(resolveTemplate('[${inputData.nil}]', ctx)).toBe('[]');
    expect(resolveTemplate('[${inputData.missing}]', ctx)).toBe('[]');
  });

  it('throws with a placeholder hint when a value cannot be JSON-stringified', () => {
    const circular: any = {};
    circular.self = circular;
    const ctx = makeCtx({ inputData: { circular } });
    expect(() => resolveTemplate('${inputData.circular}', ctx)).toThrow(/could not be JSON-stringified/);
  });
});

describe('traverseMappingPath', () => {
  it('returns the root for empty or dot paths', () => {
    const root = { a: 1 };
    expect(traverseMappingPath(root, '', 'label')).toBe(root);
    expect(traverseMappingPath(root, '.', 'label')).toBe(root);
  });

  it('walks dotted paths and throws on non-object traversal', () => {
    expect(traverseMappingPath({ a: { b: 3 } }, 'a.b', 'label')).toBe(3);
    expect(() => traverseMappingPath({ a: 1 }, 'a.b', 'my label')).toThrow(/Invalid path a\.b in my label/);
  });
});
