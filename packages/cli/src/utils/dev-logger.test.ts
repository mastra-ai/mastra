import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('..', () => ({ version: '1.0.0' }));

import { DevLogger } from './dev-logger';

describe('DevLogger startup', () => {
  let originalIsTTY: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalIsTTY) Object.defineProperty(process.stdout, 'isTTY', originalIsTTY);
    else Reflect.deleteProperty(process.stdout, 'isTTY');
  });

  it('animates during startup and replaces it with success on readiness in a TTY', () => {
    vi.useFakeTimers();
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new DevLogger();
    logger.starting();
    vi.advanceTimersByTime(160);
    expect(
      writeSpy.mock.calls.filter(([message]) => String(message).includes('Starting Mastra dev server')),
    ).toHaveLength(3);

    logger.ready('localhost', 4111, '/studio', '/api');
    expect(
      infoSpy.mock.calls.some(([message]) =>
        stripVTControlCharacters(String(message)).includes('✓ Mastra dev server started'),
      ),
    ).toBe(true);
    const writesAfterReady = writeSpy.mock.calls.length;
    vi.advanceTimersByTime(160);
    expect(writeSpy).toHaveBeenCalledTimes(writesAfterReady);
  });

  it('stops the spinner before forwarding child output', () => {
    vi.useFakeTimers();
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new DevLogger();
    logger.starting();
    logger.stopStarting();
    process.stdout.write('child log\n');
    const writesAfterOutput = writeSpy.mock.calls.length;
    expect(writeSpy.mock.calls.some(([message]) => message === 'child log\n')).toBe(true);
    vi.advanceTimersByTime(160);
    expect(writeSpy).toHaveBeenCalledTimes(writesAfterOutput);
  });

  it.each(['bundling', 'shutdown'] as const)('stops the spinner before %s output', method => {
    vi.useFakeTimers();
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new DevLogger();
    logger.starting();
    logger[method]();
    expect(
      infoSpy.mock.calls.some(([message]) =>
        String(message).includes(method === 'bundling' ? 'Bundling...' : 'Dev server stopped'),
      ),
    ).toBe(true);
    const writesAfterOutput = writeSpy.mock.calls.length;
    vi.advanceTimersByTime(160);
    expect(writeSpy).toHaveBeenCalledTimes(writesAfterOutput);
  });

  it('logs startup and success without animation when stdout is redirected', () => {
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new DevLogger();
    logger.starting();
    logger.ready('localhost', 4111, '/studio', '/api');
    expect(infoSpy.mock.calls.some(([message]) => String(message).includes('Starting Mastra dev server'))).toBe(true);
    expect(infoSpy.mock.calls.some(([message]) => String(message).includes('Mastra dev server started'))).toBe(true);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

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

  it('labels the root URL as the Factory UI under mastra factory dev', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new DevLogger();

    logger.ready('localhost', 4111, '/studio', '/api', undefined, undefined, true);

    const output = infoSpy.mock.calls.map(([message]) => stripVTControlCharacters(String(message)));
    expect(output).toContain('│ Factory UI: http://localhost:4111');
    expect(output).toContain('│ API:        http://localhost:4111/api');
    expect(output).toContain('│ Deploy:     mastra deploy');
    expect(output.some(line => line.includes('Studio:'))).toBe(false);
  });
});
