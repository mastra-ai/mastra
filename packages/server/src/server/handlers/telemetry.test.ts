import type { Mastra } from '@mastra/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTelemetryHandler } from './telemetry';

describe('Telemetry Handler', () => {
  const mockMastra = {
    getTelemetry: vi.fn(),
    getStorage: vi.fn(),
  } as unknown as Mastra & {
    getTelemetry: ReturnType<typeof vi.fn>;
    getStorage: ReturnType<typeof vi.fn>;
  };

  const mockStorage = {
    getTraces: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when telemetry is not initialized', async () => {
    mockMastra.getTelemetry.mockReturnValue(null);
    mockMastra.getStorage.mockReturnValue(mockStorage);

    await expect(
      getTelemetryHandler({
        mastra: mockMastra,
        body: {
          name: 'test',
          scope: 'test',
          page: 0,
          perPage: 100,
        },
      }),
    ).rejects.toThrow('Telemetry is not initialized');
  });

  it('should throw error when storage is not initialized', async () => {
    mockMastra.getTelemetry.mockReturnValue({});
    mockMastra.getStorage.mockReturnValue(null);

    await expect(
      getTelemetryHandler({
        mastra: mockMastra,
        body: {
          name: 'test',
          scope: 'test',
          page: 0,
          perPage: 100,
        },
      }),
    ).rejects.toThrow('Storage is not initialized');
  });

  it('should throw error when body is not provided', async () => {
    mockMastra.getTelemetry.mockReturnValue({});
    mockMastra.getStorage.mockReturnValue(mockStorage);

    await expect(
      getTelemetryHandler({
        mastra: mockMastra,
      }),
    ).rejects.toThrow('Body is required');
  });

  it('should get traces with default pagination', async () => {
    const mockTraces = [{ id: '1', name: 'test' }];
    mockMastra.getTelemetry.mockReturnValue({});
    mockMastra.getStorage.mockReturnValue(mockStorage);
    mockStorage.getTraces.mockResolvedValue(mockTraces);

    const result = await getTelemetryHandler({
      mastra: mockMastra,
      body: {
        name: 'test',
        scope: 'test',
      },
    });

    expect(result).toEqual({ traces: mockTraces });
    expect(mockStorage.getTraces).toHaveBeenCalledWith({
      name: 'test',
      scope: 'test',
      page: 0,
      perPage: 100,
      attributes: undefined,
    });
  });

  it('should get traces with custom pagination', async () => {
    const mockTraces = [{ id: '1', name: 'test' }];
    mockMastra.getTelemetry.mockReturnValue({});
    mockMastra.getStorage.mockReturnValue(mockStorage);
    mockStorage.getTraces.mockResolvedValue(mockTraces);

    const result = await getTelemetryHandler({
      mastra: mockMastra,
      body: {
        name: 'test',
        scope: 'test',
        page: 2,
        perPage: 50,
      },
    });

    expect(result).toEqual({ traces: mockTraces });
    expect(mockStorage.getTraces).toHaveBeenCalledWith({
      name: 'test',
      scope: 'test',
      page: 2,
      perPage: 50,
      attributes: undefined,
    });
  });

  it('should parse single attribute correctly', async () => {
    const mockTraces = [{ id: '1', name: 'test' }];
    mockMastra.getTelemetry.mockReturnValue({});
    mockMastra.getStorage.mockReturnValue(mockStorage);
    mockStorage.getTraces.mockResolvedValue(mockTraces);

    const result = await getTelemetryHandler({
      mastra: mockMastra,
      body: {
        name: 'test',
        scope: 'test',
        attribute: 'key:value',
      },
    });

    expect(result).toEqual({ traces: mockTraces });
    expect(mockStorage.getTraces).toHaveBeenCalledWith({
      name: 'test',
      scope: 'test',
      page: 0,
      perPage: 100,
      attributes: {
        key: 'value',
      },
    });
  });

  it('should parse multiple attributes correctly', async () => {
    const mockTraces = [{ id: '1', name: 'test' }];
    mockMastra.getTelemetry.mockReturnValue({});
    mockMastra.getStorage.mockReturnValue(mockStorage);
    mockStorage.getTraces.mockResolvedValue(mockTraces);

    const result = await getTelemetryHandler({
      mastra: mockMastra,
      body: {
        name: 'test',
        scope: 'test',
        attribute: ['key1:value1', 'key2:value2'],
      },
    });

    expect(result).toEqual({ traces: mockTraces });
    expect(mockStorage.getTraces).toHaveBeenCalledWith({
      name: 'test',
      scope: 'test',
      page: 0,
      perPage: 100,
      attributes: {
        key1: 'value1',
        key2: 'value2',
      },
    });
  });
});
