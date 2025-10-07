import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Telemetry } from '../telemetry';
import type { OtelConfig } from '../telemetry';
import type { QueryResult, QueryVectorParams } from '../vector/types';
import { MastraVector } from '../vector/vector';
import { Mastra } from '.';

const testQueryResult = [{ id: '1', score: 1.0 }];

interface WrappedVector {
  __setTelemetry: (t: Telemetry) => void;
  __setLogger: (l: unknown) => void;
  query: (params: QueryVectorParams) => Promise<QueryResult[]>;
}

class TestVector extends MastraVector {}

describe('Mastra.setTelemetry', () => {
  let mastra: Mastra;
  let telemetryInstance: Telemetry;
  let vector1: TestVector;
  let vector2: TestVector;
  let wrapped1: WrappedVector;
  let wrapped2: WrappedVector;

  beforeEach(() => {
    vi.clearAllMocks();

    vector1 = new TestVector();
    vector2 = new TestVector();

    wrapped1 = {
      __setTelemetry: vi.fn(),
      __setLogger: vi.fn(),
      query: vi.fn().mockResolvedValue(testQueryResult),
    } as WrappedVector;

    wrapped2 = {
      __setTelemetry: vi.fn(),
      __setLogger: vi.fn(),
      query: vi.fn().mockResolvedValue(testQueryResult),
    } as WrappedVector;

    telemetryInstance = {
      traceClass: vi
        .fn()
        .mockReturnValueOnce(wrapped1)
        .mockReturnValueOnce(wrapped2)
        // fallback to avoid unexpected crashes if other internals are traced
        .mockReturnValue({ __setTelemetry: vi.fn(), __setLogger: vi.fn() }),
    } as any;

    vi.spyOn(Telemetry, 'init').mockReturnValue(telemetryInstance);

    mastra = new Mastra({
      vectors: { vector1, vector2 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should wrap vectors via telemetry, call __setTelemetry once per wrapper, and preserve functionality', async () => {
    // Arrange: Create telemetry config and query params
    const telemetryConfig: OtelConfig = { serviceName: 'test-service' } as any;
    const queryParams: QueryVectorParams = { query: 'test query', topK: 1 } as any;

    // Record Telemetry.init call count before setTelemetry
    const beforeCalls = (Telemetry.init as any).mock.calls.length;

    // Act: Set telemetry
    mastra.setTelemetry(telemetryConfig);

    // Assert: Telemetry.init was called for setTelemetry with provided config
    expect((Telemetry.init as any).mock.calls.length).toBe(beforeCalls + 1);
    expect(Telemetry.init).toHaveBeenLastCalledWith(telemetryConfig);

    // Assert: traceClass called for vectors with expected args (order-agnostic)
    expect((telemetryInstance as any).traceClass).toHaveBeenCalled();
    expect((telemetryInstance as any).traceClass).toHaveBeenCalledWith(vector1, {
      excludeMethods: ['__setTelemetry', '__getTelemetry'],
    });
    expect((telemetryInstance as any).traceClass).toHaveBeenCalledWith(vector2, {
      excludeMethods: ['__setTelemetry', '__getTelemetry'],
    });

    // Assert: __setTelemetry called once per wrapped vector with telemetry instance
    expect(wrapped1.__setTelemetry).toHaveBeenCalledTimes(1);
    expect(wrapped1.__setTelemetry).toHaveBeenCalledWith(telemetryInstance);

    expect(wrapped2.__setTelemetry).toHaveBeenCalledTimes(1);
    expect(wrapped2.__setTelemetry).toHaveBeenCalledWith(telemetryInstance);

    // Assert: Preserved functionality on wrapped vectors
    const result1 = await wrapped1.query(queryParams);
    const result2 = await wrapped2.query(queryParams);
    expect(result1).toEqual(testQueryResult);
    expect(result2).toEqual(testQueryResult);
  });
});
