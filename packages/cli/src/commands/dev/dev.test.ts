import { jest } from '@jest/globals';
import { execa } from 'execa';
import { dev } from '../dev';

// Mock dependencies
jest.mock('execa');
jest.mock('fs-extra/esm');
jest.mock('fs/promises');
jest.mock('../../utils/bundle', () => ({
  bundle: jest.fn(),
  bundleServer: jest.fn(),
}));

describe('dev command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('starts server with default port (4111)', async () => {
    const mockExeca = execa as jest.MockedFunction<typeof execa>;
    
    await dev({
      port: 4111,
      env: [],
      dir: undefined,
      toolsDirs: undefined,
    });

    expect(mockExeca).toHaveBeenCalledWith(
      'node',
      ['server.mjs'],
      expect.objectContaining({
        env: expect.objectContaining({
          PORT: '4111',
        }),
      })
    );
  });

  test('starts server with custom port', async () => {
    const mockExeca = execa as jest.MockedFunction<typeof execa>;
    const customPort = 3000;
    
    await dev({
      port: customPort,
      env: [],
      dir: undefined,
      toolsDirs: undefined,
    });

    expect(mockExeca).toHaveBeenCalledWith(
      'node',
      ['server.mjs'],
      expect.objectContaining({
        env: expect.objectContaining({
          PORT: '3000',
        }),
      })
    );
  });

  test('handles port as string input', async () => {
    const mockExeca = execa as jest.MockedFunction<typeof execa>;
    const portAsString = '5000';
    
    await dev({
      port: parseInt(portAsString),
      env: [],
      dir: undefined,
      toolsDirs: undefined,
    });

    expect(mockExeca).toHaveBeenCalledWith(
      'node',
      ['server.mjs'],
      expect.objectContaining({
        env: expect.objectContaining({
          PORT: '5000',
        }),
      })
    );
  });
}); 