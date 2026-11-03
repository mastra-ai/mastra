import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { InputOptions } from 'rolldown';
import { describe, it, expect } from 'vitest';
import { removeDeployer } from './remove-deployer';

describe('Remove deployer', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  async function bundle(file: string, treeshake: InputOptions['treeshake']) {
    const build = await rolldown({
      logLevel: 'silent',
      input: file,
      treeshake,
      external: id => id !== file,
      plugins: [removeDeployer(file)],
      experimental: { attachDebugInfo: 'none' },
    });

    try {
      const result = await build.generate({ format: 'esm' });
      return result.output[0].code;
    } finally {
      await build.close();
    }
  }

  it.for([
    ['./__fixtures__/basic.js'],
    ['./__fixtures__/basic-with-const.js'],
    ['./__fixtures__/basic-with-import.js'],
    ['./__fixtures__/basic-with-spread.js'],
    ['./__fixtures__/basic-with-function.js'],
  ])('should remove the deployer from %s', async ([fileName]) => {
    const code = await bundle(join(_dirname, fileName!), { moduleSideEffects: false });

    expect(code).not.toContain('deployer:');
    expect(code).not.toContain('@mastra/deployer/test');
    expect(code).toMatchSnapshot();
  });

  // Default treeshaking keeps side-effect imports of externals, so this only passes if oxc elides the import Babel orphaned.
  it('should remove the deployer and its import from a TypeScript entry', async () => {
    const code = await bundle(join(_dirname, './__fixtures__/basic-with-types.ts'), true);

    expect(code).not.toContain('deployer');
    expect(code).not.toContain('CloudflareDeployer');
    expect(code).not.toContain('interface');
    expect(code).toMatchSnapshot();
  });
});
