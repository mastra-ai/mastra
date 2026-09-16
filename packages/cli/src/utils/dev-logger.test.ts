import { stripVTControlCharacters } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('..', () => ({ version: '1.0.0' }));

import { DevLogger } from './dev-logger';

describe('DevLogger.ready', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the deploy command after the Studio and API URLs', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new DevLogger();

    logger.ready('localhost', 4111, '/studio', '/api');

    const output = infoSpy.mock.calls.map(([message]) => stripVTControlCharacters(String(message)));
    const studioIndex = output.indexOf('│ Studio: http://localhost:4111/studio');
    const apiIndex = output.indexOf('│ API:    http://localhost:4111/api');
    const deployIndex = output.indexOf('│ Deploy: mastra deploy');

    expect(studioIndex).toBeGreaterThan(-1);
    expect(apiIndex).toBe(studioIndex + 1);
    expect(deployIndex).toBe(apiIndex + 1);
    expect(output[deployIndex]?.indexOf('mastra deploy')).toBe(output[studioIndex]?.indexOf('http'));
  });
});
