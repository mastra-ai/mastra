import { describe, expect, it } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../../request-context';
import { ComputerRequestContextView } from '../tools';

const READ_ONLY = 'computer identity is read-only in the execution context';

class EncodedContext extends RequestContext {
  public override getRaw(key: string): unknown {
    const value = super.getRaw(key);
    return typeof value === 'string' && value.startsWith('encoded:') ? value.slice(8) : value;
  }

  public override setRaw(key: string, value: unknown): void {
    super.setRaw(key, typeof value === 'string' ? `encoded:${value}` : value);
  }
}

describe('ComputerRequestContextView', () => {
  it('preserves RequestContext JSON serialization safety while overlaying identity', () => {
    const source = new RequestContext();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    source.setRaw('safe', 'value');
    source.setRaw('fn', () => 'hidden');
    source.setRaw('symbol', Symbol('hidden'));
    source.setRaw('circular', circular);
    const view = new ComputerRequestContextView(source, source, 'thread-1', 'resource-1');

    expect(JSON.parse(JSON.stringify(view))).toEqual({
      safe: 'value',
      [MASTRA_THREAD_ID_KEY]: 'thread-1',
      [MASTRA_RESOURCE_ID_KEY]: 'resource-1',
    });
    expect(JSON.parse(JSON.stringify(source))).toEqual({ safe: 'value' });
  });

  it('keeps identity read-only while ordinary values write through', () => {
    const source = new RequestContext();
    const view = new ComputerRequestContextView(source, source, 'thread-1', 'resource-1');

    view.setRaw('ordinary', 'value');
    expect(source.getRaw('ordinary')).toBe('value');
    expect(() => view.setRaw(MASTRA_THREAD_ID_KEY, 'thread-1')).not.toThrow();
    expect(() => view.set(MASTRA_RESOURCE_ID_KEY, 'resource-1')).not.toThrow();
    expect(() => view.setRaw(MASTRA_THREAD_ID_KEY, 'thread-2')).toThrow(READ_ONLY);
    expect(() => view.set(MASTRA_RESOURCE_ID_KEY, 'resource-2')).toThrow(READ_ONLY);
    expect(() => view.deleteRaw(MASTRA_THREAD_ID_KEY)).toThrow(READ_ONLY);
    expect(() => view.delete(MASTRA_RESOURCE_ID_KEY)).toThrow(READ_ONLY);
    expect(source.hasRaw(MASTRA_THREAD_ID_KEY)).toBe(false);
    expect(source.hasRaw(MASTRA_RESOURCE_ID_KEY)).toBe(false);
  });

  it('clears only source non-identity values and keeps the overlay', () => {
    const source = new RequestContext();
    source.setRaw('ordinary', 'value');
    source.setRaw(MASTRA_THREAD_ID_KEY, 'authenticated-thread');
    const view = new ComputerRequestContextView(source, source, 'authenticated-thread', 'resource-1');

    view.clear();

    expect(source.getRaw('ordinary')).toBeUndefined();
    expect(source.getRaw(MASTRA_THREAD_ID_KEY)).toBe('authenticated-thread');
    expect(view.getRaw(MASTRA_THREAD_ID_KEY)).toBe('authenticated-thread');
    expect(view.getRaw(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
  });

  it('delegates raw methods through the wrapped context', () => {
    const source = new EncodedContext();
    const inputSource = new RequestContext();
    const view = new ComputerRequestContextView(source, inputSource, 'thread-1', 'resource-1');

    view.setRaw('value', 'plain');

    expect(source.all.value).toBe('encoded:plain');
    expect(view.getRaw('value')).toBe('plain');
    expect(view.hasRaw('value')).toBe(true);
  });

  it('overrides every RequestContext prototype member', () => {
    const source = new RequestContext();
    const view = new ComputerRequestContextView(source, source, 'thread-1', 'resource-1') as any;

    for (const name of Object.getOwnPropertyNames(RequestContext.prototype).filter(name => name !== 'constructor')) {
      const ownDescriptor = Object.getOwnPropertyDescriptor(ComputerRequestContextView.prototype, name);
      const ownValue = Object.prototype.hasOwnProperty.call(view, name);
      expect(ownDescriptor || ownValue, `${name} must not read the empty super registry`).toBeTruthy();
    }
  });
});
