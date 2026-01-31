import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { esmShim } from './esm-shim';

async function buildWithEsmShim(fixturePath: string) {
  const bundle = await rollup({
    logLevel: 'silent',
    input: fixturePath,
    cache: false,
    treeshake: 'smallest',
    plugins: [
      {
        name: 'externalize-all',
        resolveId(id) {
          return {
            id,
            external: id !== fixturePath,
          };
        },
      },
      esbuild({
        target: 'esnext',
        platform: 'node',
        minify: false,
      }),
      esmShim(),
    ],
  });

  return bundle.generate({ format: 'esm' });
}

describe('ESM Shim Plugin', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it('should NOT inject shims when user already declares __filename and __dirname', async () => {
    const result = await buildWithEsmShim(join(_dirname, './__fixtures__/esm-shim-user-declared.js'));

    const code = result?.output[0].code;

    // Count occurrences of __filename declarations
    // Note: rollup may rename variables (e.g., __filename -> __filename$1) to avoid conflicts
    const filenameDeclarations = (code.match(/const __filename(\$\d+)?\s*=/g) || []).length;
    const dirnameDeclarations = (code.match(/const __dirname(\$\d+)?\s*=/g) || []).length;

    // There should be exactly ONE declaration of each (the user's own)
    // If the shim is incorrectly injected, there will be TWO declarations
    expect(filenameDeclarations).toBe(1);
    expect(dirnameDeclarations).toBe(1);

    // The code should NOT contain the shim comment since user declared their own
    expect(code).not.toContain('// -- Shims --');
  });

  it('should inject shims when user uses __filename/__dirname without declaring them', async () => {
    const result = await buildWithEsmShim(join(_dirname, './__fixtures__/esm-shim-no-declaration.js'));

    const code = result?.output[0].code;

    // Count occurrences of __filename declarations
    // Note: rollup may rename variables (e.g., __filename -> __filename$1) to avoid conflicts
    const filenameDeclarations = (code.match(/const __filename(\$\d+)?\s*=/g) || []).length;
    const dirnameDeclarations = (code.match(/const __dirname(\$\d+)?\s*=/g) || []).length;

    // There should be exactly ONE declaration of each (from the shim)
    expect(filenameDeclarations).toBe(1);
    expect(dirnameDeclarations).toBe(1);

    // The code SHOULD contain the shim since user didn't declare their own
    expect(code).toContain('// -- Shims --');
  });

  it('should NOT inject shims when user declares only __filename', async () => {
    const result = await buildWithEsmShim(join(_dirname, './__fixtures__/esm-shim-only-filename.js'));

    const code = result?.output[0].code;

    // Count occurrences of __filename declarations
    // Note: rollup may rename variables (e.g., __filename -> __filename$1) to avoid conflicts
    const filenameDeclarations = (code.match(/const __filename(\$\d+)?\s*=/g) || []).length;

    // There should be exactly ONE declaration (the user's own)
    // If the shim is incorrectly injected, there will be TWO declarations
    expect(filenameDeclarations).toBe(1);

    // Since the shim is skipped when __filename is declared,
    // __dirname should also NOT be injected (should be 0 if not used in fixture)
    const dirnameDeclarations = (code.match(/const __dirname(\$\d+)?\s*=/g) || []).length;
    expect(dirnameDeclarations).toBe(0);

    // The code should NOT contain the shim comment
    expect(code).not.toContain('// -- Shims --');
  });

  it('should NOT inject shims when user declares only __dirname', async () => {
    const result = await buildWithEsmShim(join(_dirname, './__fixtures__/esm-shim-only-dirname.js'));

    const code = result?.output[0].code;

    // Count occurrences of __dirname declarations
    // Note: rollup may rename variables (e.g., __dirname -> __dirname$1) to avoid conflicts
    const dirnameDeclarations = (code.match(/const __dirname(\$\d+)?\s*=/g) || []).length;

    // There should be exactly ONE declaration (the user's own)
    // If the shim is incorrectly injected, there will be TWO declarations
    expect(dirnameDeclarations).toBe(1);

    // Since the shim is skipped when __dirname is declared,
    // __filename should also NOT be injected (should be 0 if not used in fixture)
    const filenameDeclarations = (code.match(/const __filename(\$\d+)?\s*=/g) || []).length;
    expect(filenameDeclarations).toBe(0);

    // The code should NOT contain the shim comment
    expect(code).not.toContain('// -- Shims --');
  });
});
