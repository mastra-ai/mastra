import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolvePublishedVersion } from '../helpers/materialize-project.js';

describe('resolvePublishedVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('encodes the complete package name before requesting registry metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          'dist-tags': { test: '1.2.3' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolvePublishedVersion('http://localhost:4873', '@scope/package?variant=1', 'test')).resolves.toBe(
      '1.2.3',
    );
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4873/%40scope%2Fpackage%3Fvariant%3D1');
  });
});
