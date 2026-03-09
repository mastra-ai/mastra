import { describe, it, expect } from 'vitest';
import { defaultNameGenerator, llmRecorderPlugin } from './vite-plugin';

describe('defaultNameGenerator', () => {
  it('derives name from packages/ path', () => {
    expect(defaultNameGenerator('packages/memory/src/index.test.ts')).toBe('memory-src-index');
  });

  it('derives name from nested packages/ path', () => {
    expect(defaultNameGenerator('packages/core/src/agent/agent.test.ts')).toBe('core-src-agent-agent');
  });

  it('derives name from stores/ path', () => {
    expect(defaultNameGenerator('stores/pg/src/storage.test.ts')).toBe('pg-src-storage');
  });

  it('derives name from deployers/ path', () => {
    expect(defaultNameGenerator('deployers/vercel/src/deploy.test.ts')).toBe('vercel-src-deploy');
  });

  it('derives name from voice/ path', () => {
    expect(defaultNameGenerator('voice/openai/src/index.test.ts')).toBe('openai-src-index');
  });

  it('derives name from e2e-tests/ path', () => {
    expect(defaultNameGenerator('e2e-tests/client-js/src/api.test.ts')).toBe('client-js-src-api');
  });

  it('handles .spec.ts extension', () => {
    expect(defaultNameGenerator('packages/memory/src/index.spec.ts')).toBe('memory-src-index');
  });

  it('handles .test.tsx extension', () => {
    expect(defaultNameGenerator('packages/playground/src/App.test.tsx')).toBe('playground-src-App');
  });

  it('normalizes Windows backslashes', () => {
    expect(defaultNameGenerator('packages\\memory\\src\\index.test.ts')).toBe('memory-src-index');
  });

  it('handles absolute paths', () => {
    expect(defaultNameGenerator('/home/user/project/packages/memory/src/index.test.ts')).toBe('memory-src-index');
  });

  it('falls back to basename for unrecognized paths', () => {
    expect(defaultNameGenerator('/some/random/path/my-tests.test.ts')).toBe('my-tests');
  });

  it('handles integration-tests nested packages', () => {
    expect(defaultNameGenerator('packages/memory/integration-tests/src/shared/agent-memory.test.ts')).toBe(
      'memory-integration-tests-src-shared-agent-memory',
    );
  });
});

describe('llmRecorderPlugin', () => {
  function getPlugin(options?: Parameters<typeof llmRecorderPlugin>[0]) {
    const plugin = llmRecorderPlugin(options);
    // The plugin's transform function
    const transform = (plugin as any).transform as (code: string, id: string) => { code: string; map: null } | null;
    return { plugin, transform };
  }

  it('returns a valid Vite plugin', () => {
    const plugin = llmRecorderPlugin();
    expect(plugin.name).toBe('vitest-llm-recorder');
    expect(plugin.enforce).toBe('pre');
  });

  it('transforms test files', () => {
    const { transform } = getPlugin();
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { useLLMRecording as __autoUseLLMRecording }');
    expect(result!.code).toContain('__autoUseLLMRecording("core-src-agent")');
    expect(result!.code).toContain('describe("test", () => {});');
  });

  it('skips non-test files', () => {
    const { transform } = getPlugin();
    const result = transform('export const foo = 1;', '/project/packages/core/src/agent.ts');

    expect(result).toBeNull();
  });

  it('skips files that already use useLLMRecording', () => {
    const { transform } = getPlugin();
    const code = `
      import { useLLMRecording } from '@internal/llm-recorder';
      describe('test', () => {
        useLLMRecording('my-tests');
      });
    `;
    const result = transform(code, '/project/packages/core/src/agent.test.ts');

    expect(result).toBeNull();
  });

  it('skips files that already use enableAutoRecording', () => {
    const { transform } = getPlugin();
    const code = `
      import { enableAutoRecording } from '@internal/llm-recorder';
      enableAutoRecording();
    `;
    const result = transform(code, '/project/packages/core/src/agent.test.ts');

    expect(result).toBeNull();
  });

  it('respects exclude patterns', () => {
    const { transform } = getPlugin({
      exclude: ['**/unit/**'],
    });
    const result = transform('describe("test", () => {});', '/project/packages/core/src/unit/agent.test.ts');

    expect(result).toBeNull();
  });

  it('respects custom include patterns', () => {
    const { transform } = getPlugin({
      include: ['**/integration/**/*.test.ts'],
    });

    // Should skip non-matching test files
    const result1 = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');
    expect(result1).toBeNull();

    // Should transform matching test files
    const result2 = transform('describe("test", () => {});', '/project/packages/core/integration/agent.test.ts');
    expect(result2).not.toBeNull();
  });

  it('uses custom name generator', () => {
    const { transform } = getPlugin({
      nameGenerator: () => 'custom-name',
    });
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain('__autoUseLLMRecording("custom-name")');
  });

  it('passes recordingsDir option', () => {
    const { transform } = getPlugin({
      recordingsDir: '/custom/dir',
    });
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain('recordingsDir: "/custom/dir"');
  });

  it('skips node_modules by default', () => {
    const { transform } = getPlugin();
    const result = transform('describe("test", () => {});', '/project/node_modules/some-pkg/src/agent.test.ts');

    expect(result).toBeNull();
  });

  it('skips dist by default', () => {
    const { transform } = getPlugin();
    const result = transform('describe("test", () => {});', '/project/dist/src/agent.test.ts');

    expect(result).toBeNull();
  });

  it('produces syntactically valid code', () => {
    const { transform } = getPlugin();
    const originalCode = `import { describe, it, expect } from 'vitest';

describe('My Tests', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});`;

    const result = transform(originalCode, '/project/packages/core/src/agent.test.ts');
    expect(result).not.toBeNull();

    // Should have import before original code
    const lines = result!.code.split('\n');
    const importLine = lines.findIndex(l => l.includes('__autoUseLLMRecording'));
    const originalImportLine = lines.findIndex(l => l.includes("from 'vitest'"));

    expect(importLine).toBeLessThan(originalImportLine);
  });

  it('injects @internal/llm-recorder import', () => {
    const { transform } = getPlugin();
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain("from '@internal/llm-recorder'");
  });

  it('injects transformRequest import and option', () => {
    const { transform } = getPlugin({
      transformRequest: {
        importPath: './my-transform',
        exportName: 'normalizeRequest',
      },
    });
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain(`import { normalizeRequest as __autoTransformRequest } from "./my-transform";`);
    expect(result!.code).toContain('transformRequest: __autoTransformRequest');
  });

  it('defaults transformRequest exportName to "transformRequest"', () => {
    const { transform } = getPlugin({
      transformRequest: {
        importPath: '@internal/test-utils',
      },
    });
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain(
      `import { transformRequest as __autoTransformRequest } from "@internal/test-utils";`,
    );
  });

  it('combines recordingsDir and transformRequest options', () => {
    const { transform } = getPlugin({
      recordingsDir: '/custom/dir',
      transformRequest: {
        importPath: './transform',
        exportName: 'myTransform',
      },
    });
    const result = transform('describe("test", () => {});', '/project/packages/core/src/agent.test.ts');

    expect(result).not.toBeNull();
    expect(result!.code).toContain('recordingsDir: "/custom/dir"');
    expect(result!.code).toContain('transformRequest: __autoTransformRequest');
  });
});
