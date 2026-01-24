import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  let buffer: RingBuffer<number>;

  beforeEach(() => {
    buffer = new RingBuffer<number>(5);
  });

  it('should add items and return them in order', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    expect(buffer.toArray()).toEqual([1, 2, 3]);
  });

  it('should report correct size', () => {
    expect(buffer.getSize()).toBe(0);

    buffer.push(1);
    expect(buffer.getSize()).toBe(1);

    buffer.push(2);
    buffer.push(3);
    expect(buffer.getSize()).toBe(3);
  });

  it('should overwrite oldest items when at capacity', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);
    buffer.push(5);

    // Buffer is now full
    expect(buffer.toArray()).toEqual([1, 2, 3, 4, 5]);

    // Add one more - should overwrite 1
    buffer.push(6);
    expect(buffer.toArray()).toEqual([2, 3, 4, 5, 6]);

    // Add two more
    buffer.push(7);
    buffer.push(8);
    expect(buffer.toArray()).toEqual([4, 5, 6, 7, 8]);
  });

  it('should maintain capacity after overwrites', () => {
    for (let i = 1; i <= 10; i++) {
      buffer.push(i);
    }

    expect(buffer.getSize()).toBe(5);
    expect(buffer.toArray()).toEqual([6, 7, 8, 9, 10]);
  });

  it('should get tail items (newest)', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);
    buffer.push(5);

    expect(buffer.getTail(3)).toEqual([3, 4, 5]);
    expect(buffer.getTail(1)).toEqual([5]);
    expect(buffer.getTail(5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle getTail when requesting more than available', () => {
    buffer.push(1);
    buffer.push(2);

    expect(buffer.getTail(10)).toEqual([1, 2]);
  });

  it('should clear the buffer', () => {
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    buffer.clear();

    expect(buffer.getSize()).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it('should work with objects', () => {
    const objectBuffer = new RingBuffer<{ id: number }>(3);

    objectBuffer.push({ id: 1 });
    objectBuffer.push({ id: 2 });
    objectBuffer.push({ id: 3 });
    objectBuffer.push({ id: 4 });

    expect(objectBuffer.toArray()).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it('should work with capacity of 1', () => {
    const singleBuffer = new RingBuffer<string>(1);

    singleBuffer.push('a');
    expect(singleBuffer.toArray()).toEqual(['a']);

    singleBuffer.push('b');
    expect(singleBuffer.toArray()).toEqual(['b']);
  });
});
