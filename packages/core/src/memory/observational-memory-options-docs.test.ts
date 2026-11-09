import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'types.ts'), 'utf8');

/** The `@default` value in the JSDoc block directly above `property` inside `interface <name>`. */
function documentedDefault(interfaceName: string, property: string): string {
  const start = source.indexOf(`export interface ${interfaceName} {`);
  expect(start, `${interfaceName} not found`).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf('\n}\n', start));
  const match = new RegExp(`/\\*\\*((?:(?!\\*/)[\\s\\S])*?)\\*/\\s*${property}\\?:`).exec(body);
  expect(match, `${interfaceName}.${property} JSDoc not found`).not.toBeNull();
  const tag = /@default\s+([^\n]+)/.exec(match![1]!);
  expect(tag, `${interfaceName}.${property} has no @default`).not.toBeNull();
  return tag![1]!.trim();
}

describe('Observational Memory option JSDoc defaults', () => {
  it("ObservationalMemoryOptions.model documents the real default, 'auto'", () => {
    expect(documentedDefault('ObservationalMemoryOptions', 'model')).toMatch(/^'auto'/);
  });

  it.each([
    ['ObservationalMemoryObservationConfig', 'reflection'],
    ['ObservationalMemoryReflectionConfig', 'observation'],
  ])('%s.model documents the fallback chain: top-level, %s.model, then auto', (name, other) => {
    const doc = documentedDefault(name, 'model');
    expect(doc).toContain(`top-level \`model\`, else \`${other}.model\`, else \`'auto'\``);
  });

  it.each([
    'ObservationalMemoryObservationConfig',
    'ObservationalMemoryReflectionConfig',
    'ObservationalMemoryOptions',
  ])('%s.model documents the Google provider eligibility override', name => {
    const start = source.indexOf(`export interface ${name} {`);
    const body = source.slice(start, source.indexOf('\n}\n', start));
    const modelDoc = body.slice(0, body.indexOf("model?: AgentConfig['model']"));
    expect(modelDoc).toContain("canUseProvider('google')");
    expect(modelDoc).toContain('`GOOGLE_GENERATIVE_AI_API_KEY`');
    expect(modelDoc).toContain('when no callback is configured');
  });

  it('documents the observeAttachments allowlist default', () => {
    expect(documentedDefault('ObservationalMemoryObservationConfig', 'observeAttachments')).toBe(
      "['image/*', 'application/pdf']",
    );
  });
});
