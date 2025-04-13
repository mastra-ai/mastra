import { describe, expect, it } from 'vitest';
import milvus from './index';

describe('Milvus', () => {
  it('should be defined', () => {
    expect(true).toBe(true);
  });

  it('should return Milvus', () => {
    expect(milvus()).toBe('Milvus');
  });
});
