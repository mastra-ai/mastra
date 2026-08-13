import { describe, expect, it } from 'vitest';
import { compressSnapshot, decompressSnapshot } from './index';

describe('MongoDB Workflow Snapshot Compression (#21412)', () => {
  it('should leave small snapshots uncompressed', () => {
    const smallSnapshot = {
      status: 'success',
      context: { step1: { output: 'hello world' } },
    };

    const compressed = compressSnapshot(smallSnapshot);
    expect(compressed).toEqual(smallSnapshot);

    const decompressed = decompressSnapshot(compressed);
    expect(decompressed).toEqual(smallSnapshot);
  });

  it('should compress large snapshots (>256KB) with __gz: prefix', () => {
    // Generate a ~1MB snapshot payload
    const largeData = 'x'.repeat(1024 * 1024);
    const largeSnapshot = {
      status: 'running',
      context: {
        heavyStep: { output: { data: largeData } },
      },
    };

    const compressed = compressSnapshot(largeSnapshot);
    expect(typeof compressed).toBe('string');
    expect(compressed.startsWith('__gz:')).toBe(true);

    // Verify significant compression ratio (>80%)
    const rawJsonLength = JSON.stringify(largeSnapshot).length;
    expect(compressed.length).toBeLessThan(rawJsonLength * 0.2);

    const decompressed = decompressSnapshot(compressed);
    expect(decompressed).toEqual(largeSnapshot);
  });

  it('should handle raw JSON string inputs and compress them if large', () => {
    const largeData = 'y'.repeat(500 * 1024);
    const rawJson = JSON.stringify({
      status: 'suspended',
      context: { step: { data: largeData } },
    });

    const compressed = compressSnapshot(rawJson);
    expect(typeof compressed).toBe('string');
    expect(compressed.startsWith('__gz:')).toBe(true);

    const decompressed = decompressSnapshot(compressed);
    expect(decompressed.context.step.data).toBe(largeData);
  });

  it('should be idempotent when passing an already compressed snapshot string', () => {
    const largeData = 'z'.repeat(300 * 1024);
    const snapshot = { status: 'pending', context: { data: largeData } };

    const firstCompress = compressSnapshot(snapshot);
    const secondCompress = compressSnapshot(firstCompress);
    expect(secondCompress).toBe(firstCompress);

    const decompressed = decompressSnapshot(secondCompress);
    expect(decompressed).toEqual(snapshot);
  });

  it('should decompress legacy uncompressed BSON object snapshots losslessly', () => {
    const legacySnapshot = {
      status: 'completed',
      context: { stepA: { result: 42 } },
    };

    const result = decompressSnapshot(legacySnapshot);
    expect(result).toEqual(legacySnapshot);
  });

  it('should safely fall back for uncompressed JSON strings', () => {
    const legacyString = JSON.stringify({ status: 'completed', value: 123 });

    const result = decompressSnapshot(legacyString);
    expect(result).toEqual({ status: 'completed', value: 123 });
  });

  it('should compresses 20MB raw JSON snapshots down to ~1.2MB, preventing MongoDB 16MB limit crashes', () => {
    // Generate a 20MB snapshot (would crash MongoDB 16MB document limit if uncompressed)
    const twentyMbData = 'a'.repeat(20 * 1024 * 1024);
    const hugeSnapshot = {
      status: 'running',
      context: {
        step1: { payload: twentyMbData },
      },
    };

    const compressed = compressSnapshot(hugeSnapshot);
    expect(typeof compressed).toBe('string');
    expect(compressed.startsWith('__gz:')).toBe(true);

    // Base64 compressed length should be < 2MB (well under MongoDB 16MB limit)
    expect(compressed.length).toBeLessThan(2 * 1024 * 1024);

    const decompressed = decompressSnapshot(compressed);
    expect(decompressed.context.step1.payload).toBe(twentyMbData);
  });
});
