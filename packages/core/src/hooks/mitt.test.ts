import { describe, it, beforeEach, expect, vi } from 'vitest';
import mitt from './mitt';
import type { Emitter } from './mitt';

describe('mitt.off', () => {
  let emitter: Emitter<{ foo: string }>;
  let handler1: (e: string) => void;
  let handler2: (e: string) => void;
  let nonExistentHandler: (e: string) => void;

  beforeEach(() => {
    // Initialize a new emitter before each test
    emitter = mitt();
    handler1 = vi.fn();
    handler2 = vi.fn();
    nonExistentHandler = vi.fn();
  });

  it('should remove only the specific handler when handler is provided', () => {
    // Arrange: Register multiple handlers for the 'foo' event
    emitter.on('foo', handler1);
    emitter.on('foo', handler2);

    // Act: Remove one specific handler
    emitter.off('foo', handler1);

    // Assert: Verify handler removal and emission behavior
    emitter.emit('foo', 'test');
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith('test');
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should remove all handlers when no handler is provided', () => {
    // Arrange: Register multiple handlers for the 'foo' event
    emitter.on('foo', handler1);
    emitter.on('foo', handler2);

    // Act: Remove all handlers for the event type
    emitter.off('foo');

    // Assert: Verify all handlers are removed
    emitter.emit('foo', 'test');
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should safely handle calling off() on event type with no handlers', () => {
    // Arrange: Create a fresh handler for testing
    const unusedHandler = vi.fn();

    // Act & Assert: Verify both variants don't throw errors
    expect(() => {
      emitter.off('foo'); // Remove all handlers for non-existent event
    }).not.toThrow();

    expect(() => {
      emitter.off('foo', unusedHandler); // Remove specific handler for non-existent event
    }).not.toThrow();

    // Assert: Verify the emitter's state remains valid
    emitter.on('foo', handler1);
    emitter.emit('foo', 'test');
    expect(handler1).toHaveBeenCalledWith('test');
    expect(handler1).toHaveBeenCalledTimes(1);
  });

  it('should preserve existing handlers when removing non-existent handler', () => {
    // Arrange: Register two valid handlers for 'foo' event
    emitter.on('foo', handler1);
    emitter.on('foo', handler2);

    // Act: Attempt to remove non-existent handler and emit event
    emitter.off('foo', nonExistentHandler);
    emitter.emit('foo', 'test');

    // Assert: Verify both original handlers were called and non-existent handler was never called
    expect(handler1).toHaveBeenCalledWith('test');
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith('test');
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(nonExistentHandler).not.toHaveBeenCalled();
  });
});
