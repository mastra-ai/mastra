import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectIosBrowser } from './platform';

function stubNavigator(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectIosBrowser', () => {
  it('detects iPhone Safari', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      5,
    );
    expect(detectIosBrowser()).toBe('safari');
  });

  it('detects iPad Safari', () => {
    stubNavigator(
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      5,
    );
    expect(detectIosBrowser()).toBe('safari');
  });

  it('detects iPadOS masquerading as macOS via touch points', () => {
    stubNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      5,
    );
    expect(detectIosBrowser()).toBe('safari');
  });

  it('detects Chrome on iOS', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
      5,
    );
    expect(detectIosBrowser()).toBe('chrome');
  });

  it('detects Firefox on iOS', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
      5,
    );
    expect(detectIosBrowser()).toBe('firefox');
  });

  it('detects Edge on iOS', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.56 Version/17.0 Mobile/15E148 Safari/604.1',
      5,
    );
    expect(detectIosBrowser()).toBe('edge');
  });

  it('detects Opera on iOS', () => {
    stubNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.5.1 Mobile/15E148 Safari/604.1',
      5,
    );
    expect(detectIosBrowser()).toBe('opera');
  });

  it('is null for desktop macOS Safari (no touch)', () => {
    stubNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      0,
    );
    expect(detectIosBrowser()).toBeNull();
  });

  it('is null for Android Chrome', () => {
    stubNavigator(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      5,
    );
    expect(detectIosBrowser()).toBeNull();
  });

  it('is null for desktop Chrome', () => {
    stubNavigator(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      0,
    );
    expect(detectIosBrowser()).toBeNull();
  });

  it('is null when navigator is undefined', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectIosBrowser()).toBeNull();
  });
});
