import { beforeEach, describe, it, expectTypeOf } from 'vitest';
import { RuntimeContext } from '..';
import type { UUIDv4, Weather, Time } from './types';

const exampleUUID: UUIDv4 = '1e5efda9-7ead-455a-bd69-6e49631973db';
const exampleWeather: Weather = Object.freeze({ scale: 'celsius', temperature: 22 });
const exampleTime: Time = '10:45 AM';

let runtimeContext: RuntimeContext;
beforeEach(() => {
  runtimeContext = new RuntimeContext();
});

describe('Runtime context type inference with base RuntimeContextInterface', () => {
  describe('constructor', () => {
    it('permits construction with string keys', () => {
      new RuntimeContext([
        ['id', '1'],
        ['timestamp', 1000],
      ]);
    });

    it('forbids non-string keys in the constructor', () => {
      // @ts-expect-error
      new RuntimeContext([
        [3, true],
        [{ id: '1' }, '1'],
      ]);
    });
  });

  describe('.set()', () => {
    it('should allow values with the right types', () => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
    });

    it('should allow values to be replaced with different types', () => {
      runtimeContext.set('id', 'exampleUUID');
      runtimeContext.set('weather', { scale: 'kelvin', temperature: 22 });
      runtimeContext.set('weather', { scale: 'celsius', temperature: '22' });
      runtimeContext.set('time', '10:00 UTC');
    });

    it('should permit setting properties not in the type', () => {
      runtimeContext.set('name', 'test name');
      runtimeContext.set('count', 99);
    });
  });

  describe('.get()', () => {
    it('should allow any string to be passed', () => {
      expectTypeOf(runtimeContext.get).parameter(0).toBeString();
    });

    it('should infer `unknown` for values on keys that not in the type and not set', () => {
      expectTypeOf(runtimeContext.get('non-existent-key')).toBeUnknown();
    });

    it('should infer set values as unknown', () => {
      runtimeContext.set('new-key', 'value');
      expectTypeOf(runtimeContext.get('new-key')).toBeUnknown();
    });

    // TODO: replace above test with below once we can infer dynamically set properties
    // it('should infer the correct type for added keys', () => {
    //   runtimeContext.set('new-key', 'value');
    //   runtimeContext.set('count', 99);
    //   expectTypeOf(runtimeContext.get('new-key')).toBeString();
    //   expectTypeOf(runtimeContext.get('count')).toBeNumber();
    // });
  });

  describe('.keys()', () => {
    beforeEach(() => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
    });

    it('should infer keys to be strings', () => {
      for (const key of runtimeContext.keys()) {
        expectTypeOf(key).toBeString();
        expectTypeOf(runtimeContext.get(key)).not.toBeAny();
      }
    });
  });

  describe('.values()', () => {
    beforeEach(() => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
    });

    it('returns an iterator of the union of value types', () => {
      const values = runtimeContext.values();
      expectTypeOf(values).toEqualTypeOf<MapIterator<never>>();
      for (const value of values) {
        expectTypeOf(value).not.toBeAny();
      }
    });
  });

  describe('.entries()', () => {
    it('should infer keys as strings and values as unknown', () => {
      for (const [key, value] of runtimeContext.entries()) {
        expectTypeOf(key).toBeString();
        expectTypeOf(value).toBeUnknown();
      }
    });
  });
});
