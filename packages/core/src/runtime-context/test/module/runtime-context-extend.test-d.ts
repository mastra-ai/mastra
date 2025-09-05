import { beforeEach, describe, it, expectTypeOf } from 'vitest';
import { RuntimeContext } from '../..';
import type { UUIDv4, Weather, Time } from '../types';
import './test-interface-augmentation';

const exampleUUID: UUIDv4 = '1e5efda9-7ead-455a-bd69-6e49631973db';
const exampleWeather: Weather = Object.freeze({ scale: 'celsius', temperature: 22 });
const exampleTime: Time = '10:45 AM';

declare module '../..' {
  interface RuntimeContextInterface {
    id: UUIDv4;
    weather: Weather;
    time: Time;
  }
}

let runtimeContext: RuntimeContext;
beforeEach(() => {
  runtimeContext = new RuntimeContext();
});

describe('Runtime context type inference with extension of RuntimeContextInterface', () => {
  describe('.set()', () => {
    it('should allow values with the right types for keys in the interface', () => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
    });

    it('should forbid changing the type on keys defined in the interface', () => {
      // @ts-expect-error
      runtimeContext.set('id', 'exampleUUID');
      // @ts-expect-error
      runtimeContext.set('weather', { scale: 'kelvin', temperature: 22 });
      // @ts-expect-error
      runtimeContext.set('weather', { scale: 'celsius', temperature: '22' });
      // @ts-expect-error
      runtimeContext.set('time', '10:00 UTC');
    });

    it('should permit setting properties not in the interface', () => {
      runtimeContext.set('name', 'test name');
      runtimeContext.set('count', 99);
    });
  });

  describe('.get()', () => {
    it('should narrow the return type for properties defined on the type', () => {
      expectTypeOf(runtimeContext.get('id')).toEqualTypeOf<UUIDv4>();
      expectTypeOf(runtimeContext.get('weather')).toEqualTypeOf<Weather>();
      expectTypeOf(runtimeContext.get('time')).toEqualTypeOf<Time>();
    });

    it('should infer `unknown` for values on keys that not in the interface and not set', () => {
      expectTypeOf(runtimeContext.get('non-existent-key')).toBeUnknown();
    });

    it('should infer `unknown` for values on keys not in the interface', () => {
      runtimeContext.set('new-key', 'value');
      runtimeContext.set('count', 99);
      expectTypeOf(runtimeContext.get('new-key')).toBeUnknown();
      expectTypeOf(runtimeContext.get('count')).toBeUnknown();
    });
  });

  describe('.keys()', () => {
    it('should allow type narrowing of values', () => {
      for (const key of runtimeContext.keys()) {
        expectTypeOf(key).toBeString();
        expectTypeOf(key).toEqualTypeOf<'id' | 'weather' | 'time'>();
        expectTypeOf(runtimeContext.get(key)).not.toBeAny();
        if (key === 'id') {
          expectTypeOf(runtimeContext.get(key)).toEqualTypeOf<UUIDv4>();
        } else if (key === 'weather') {
          expectTypeOf(runtimeContext.get(key)).toEqualTypeOf<Weather>();
        } else if (key === 'time') {
          expectTypeOf(runtimeContext.get(key)).toEqualTypeOf<Time>();
        }
      }
    });

    it('should narrow key type to `never` once all set keys are ruled out', () => {
      for (const key of runtimeContext.keys()) {
        if (key != 'id' && key != 'weather' && key != 'time') {
          expectTypeOf(key).toBeNever();
        }
      }
    });
  });
  describe('.values()', () => {
    it('returns an iterator of the union of value types', () => {
      const values = runtimeContext.values();
      expectTypeOf(values).toEqualTypeOf<MapIterator<UUIDv4 | Weather | Time>>();
      for (const value of values) {
        expectTypeOf(value).not.toBeAny();
      }
    });
  });

  describe('.entries()', () => {
    it('should allow exhaustive type narrowing of values', () => {
      for (const [key, value] of runtimeContext.entries()) {
        expectTypeOf(value).not.toBeAny();
        if (key === 'id') {
          expectTypeOf(value).toEqualTypeOf<UUIDv4>();
        } else if (key === 'weather') {
          expectTypeOf(value).toEqualTypeOf<Weather>();
        } else if (key === 'time') {
          expectTypeOf(value).toEqualTypeOf<Time>();
        } else {
          expectTypeOf(value).toBeNever();
        }
      }
    });

    it('should narrow values to `never` once all set keys are ruled out', () => {
      for (const [key, value] of runtimeContext.entries()) {
        if (key != 'id' && key != 'weather' && key != 'time') {
          expectTypeOf(value).toBeNever();
        }
      }
    });
  });
});
