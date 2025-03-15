import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getTelemetryBundler } from './telemetry';

describe('getTelemetryConfig', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./plugins/__fixtures__/basic.js'],
    ['./plugins/__fixtures__/basic-with-const.js'],
    ['./plugins/__fixtures__/basic-with-import.js'],
    ['./plugins/__fixtures__/basic-with-function.js'],
    ['./__fixtures__/no-telemetry.js'],
  ])('should be able to extract the telemetry config from %s', async ([fileName]) => {
    const hasConfigResult = {
      hasCustomConfig: false,
    } as const;
    const bundle = await getTelemetryBundler(join(_dirname, fileName), hasConfigResult);

    const result = await bundle.generate({
      format: 'esm',
    });

    expect(result?.output[0].code).toMatchSnapshot();
    expect(hasConfigResult.hasCustomConfig).toBe(!fileName.endsWith('no-telemetry.js'));
  });
});
