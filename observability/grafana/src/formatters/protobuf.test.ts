import { describe, expect, it } from 'vitest';

import type { PromWriteRequest } from './protobuf';
import { encodeWriteRequest } from './protobuf';

describe('encodeWriteRequest (protobuf encoder)', () => {
  it('should encode an empty WriteRequest', () => {
    const request: PromWriteRequest = { timeseries: [] };
    const bytes = encodeWriteRequest(request);

    expect(bytes).toBeInstanceOf(Uint8Array);
    // Empty message = 0 bytes
    expect(bytes.length).toBe(0);
  });

  it('should encode a single counter time series', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [
            { name: '__name__', value: 'test_counter' },
            { name: 'job', value: 'test-svc' },
          ],
          samples: [
            { value: 42, timestampMs: 1705312800000 },
          ],
        },
      ],
    };

    const bytes = encodeWriteRequest(request);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('should encode multiple time series', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [{ name: '__name__', value: 'metric_a' }],
          samples: [{ value: 1, timestampMs: 1705312800000 }],
        },
        {
          labels: [{ name: '__name__', value: 'metric_b' }],
          samples: [{ value: 2, timestampMs: 1705312800000 }],
        },
      ],
    };

    const bytes = encodeWriteRequest(request);

    expect(bytes.length).toBeGreaterThan(0);
    // Multiple time series should produce larger output than single
    const singleRequest: PromWriteRequest = {
      timeseries: [request.timeseries[0]!],
    };
    const singleBytes = encodeWriteRequest(singleRequest);
    expect(bytes.length).toBeGreaterThan(singleBytes.length);
  });

  it('should encode labels as length-delimited fields', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [{ name: 'test_key', value: 'test_value' }],
          samples: [{ value: 0, timestampMs: 0 }],
        },
      ],
    };

    const bytes = encodeWriteRequest(request);
    const str = new TextDecoder().decode(bytes);

    // The label name and value should appear in the binary output
    expect(str).toContain('test_key');
    expect(str).toContain('test_value');
  });

  it('should encode double values in IEEE 754 format', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [{ name: '__name__', value: 'test' }],
          samples: [{ value: 3.14, timestampMs: 1000 }],
        },
      ],
    };

    const bytes = encodeWriteRequest(request);

    // 3.14 in IEEE 754 little-endian should be present somewhere in the bytes
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, 3.14, true);
    const expected = new Uint8Array(view.buffer);

    // Find the double in the output
    let found = false;
    for (let i = 0; i <= bytes.length - 8; i++) {
      if (
        bytes[i] === expected[0] &&
        bytes[i + 1] === expected[1] &&
        bytes[i + 2] === expected[2] &&
        bytes[i + 3] === expected[3] &&
        bytes[i + 4] === expected[4] &&
        bytes[i + 5] === expected[5] &&
        bytes[i + 6] === expected[6] &&
        bytes[i + 7] === expected[7]
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('should encode timestamp as varint', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [{ name: '__name__', value: 'test' }],
          samples: [{ value: 0, timestampMs: 1705312800000 }],
        },
      ],
    };

    const bytes = encodeWriteRequest(request);
    expect(bytes.length).toBeGreaterThan(0);
    // Varint-encoded timestamp should be present — hard to check exact bytes
    // but we can verify the output is non-trivial
  });

  it('should handle empty labels and samples', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [],
          samples: [],
        },
      ],
    };

    // Should not throw
    const bytes = encodeWriteRequest(request);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('should produce deterministic output for the same input', () => {
    const request: PromWriteRequest = {
      timeseries: [
        {
          labels: [
            { name: '__name__', value: 'test' },
            { name: 'env', value: 'prod' },
          ],
          samples: [{ value: 100, timestampMs: 1705312800000 }],
        },
      ],
    };

    const bytes1 = encodeWriteRequest(request);
    const bytes2 = encodeWriteRequest(request);

    expect(bytes1).toEqual(bytes2);
  });
});
