import { afterEach, describe, expect, it, vi } from 'vitest';

import { customEndpointUrlProblem } from './custom-endpoint-url.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('custom endpoint URLs on a hosted Factory', () => {
  it.each([
    'http://api.example.com/v1',
    'https://localhost:11434/v1',
    'https://ollama.localhost/v1',
    'https://printer.local/v1',
    'https://vllm.railway.internal/v1',
    'https://metadata.google.internal/v1',
    'https://127.0.0.1/v1',
    'https://2130706433/v1',
    'https://10.0.0.5/v1',
    'https://172.20.1.1/v1',
    'https://192.168.1.10/v1',
    'https://169.254.169.254/latest',
    'https://100.64.0.1/v1',
    'https://0.0.0.0/v1',
    'https://[::1]/v1',
    'https://[::ffff:127.0.0.1]/v1',
    'https://[fd00::1]/v1',
    'https://[fe80::1]/v1',
  ])('refuses %s', url => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deploy-1');

    expect(customEndpointUrlProblem(url)).toBeDefined();
  });

  it.each(['https://api.example.com/v1', 'https://8.8.8.8/v1', 'https://[2606:4700::1111]/v1'])('allows %s', url => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deploy-1');

    expect(customEndpointUrlProblem(url)).toBeUndefined();
  });
});

describe('custom endpoint URLs on a local or self-hosted Factory', () => {
  it.each(['http://localhost:11434/v1', 'http://10.0.0.5/v1', 'https://vllm.railway.internal/v1'])('allows %s', url => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', '');

    expect(customEndpointUrlProblem(url)).toBeUndefined();
  });
});
