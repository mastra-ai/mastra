import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import esmShim from '@rollup/plugin-esm-shim';

describe('ESM Shim Plugin', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it('should NOT inject shims when user already declares __filename and __dirname (issue #10054)', async () => {
    const file = join(_dirname, './__fixtures__/esm-shim-user-declared.js');

    const bundle = await rollup({
      logLevel: 'silent',
      input: file,
      cache: false,
      treeshake: 'smallest',
      plugins: [
        {
          name: 'externalize-all',
          resolveId(id) {
            return {
              id,
              external: id !== file,
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

    const result = await bundle.generate({
      format: 'esm',
    });

    const code = result?.output[0].code;

    // Count occurrences of __filename declarations
    const filenameDeclarations = (code.match(/const __filename\s*=/g) || []).length;
    const dirnameDeclarations = (code.match(/const __dirname\s*=/g) || []).length;

    // There should be exactly ONE declaration of each (the user's own)
    // If the shim is incorrectly injected, there will be TWO declarations
    expect(filenameDeclarations).toBe(1);
    expect(dirnameDeclarations).toBe(1);

    // The code should NOT contain the shim comment since user declared their own
    expect(code).not.toContain('// -- Shims --');
  });

  it('should inject shims when user uses __filename/__dirname without declaring them', async () => {
    const file = join(_dirname, './__fixtures__/esm-shim-no-declaration.js');

    const bundle = await rollup({
      logLevel: 'silent',
      input: file,
      cache: false,
      treeshake: 'smallest',
      plugins: [
        {
          name: 'externalize-all',
          resolveId(id) {
            return {
              id,
              external: id !== file,
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

    const result = await bundle.generate({
      format: 'esm',
    });

    const code = result?.output[0].code;

    // Count occurrences of __filename declarations
    const filenameDeclarations = (code.match(/const __filename\s*=/g) || []).length;
    const dirnameDeclarations = (code.match(/const __dirname\s*=/g) || []).length;

    // There should be exactly ONE declaration of each (from the shim)
    expect(filenameDeclarations).toBe(1);
    expect(dirnameDeclarations).toBe(1);

    // The code SHOULD contain the shim since user didn't declare their own
    expect(code).toContain('// -- Shims --');
  });
});
