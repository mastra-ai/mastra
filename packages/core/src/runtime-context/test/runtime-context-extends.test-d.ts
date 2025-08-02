import { beforeEach, describe, it, expectTypeOf, assertType } from 'vitest';
import { RuntimeContext } from '..';

type UUIDv4 = `${string}-${string}-${string}-${string}-${string}`;
type TemperatureScale = 'celsius' | 'fahrenheit';
type Weather = {
  scale: TemperatureScale;
  temperature: number;
};
type Time = `${number}:${number} ${'AM' | 'PM'}`;

const exampleUUID: UUIDv4 = '1e5efda9-7ead-455a-bd69-6e49631973db';
const exampleWeather = Object.freeze({ scale: 'celsius', temperature: 22 });
const exampleTime: Time = '10:45 AM';

declare module '..' {
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

describe('Runtime Context Types', () => {
  describe('.set()', () => {
    it('should allow values with the right types', () => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
    });

    // it('should forbid changing the type on a key', () => {
    //   // @ts-expect-error
    //   runtimeContext.set('id', 'exampleUUID');
    //   // @ts-expect-error
    //   runtimeContext.set('weather', { scale: 'kelvin', temperature: 22 });
    //   // @ts-expect-error
    //   runtimeContext.set('weather', { scale: 'celsius', temperature: '22' });
    //   // @ts-expect-error
    //   runtimeContext.set('time', '10:00 UTC');
    // });

    it('should permit setting properties not in the type', () => {
      runtimeContext.set('name', 'test name');
      runtimeContext.set('temperature', '22');
    });
  });

  describe('.get()', () => {
    it('should narrow the return type based on the key', () => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
      assertType<UUIDv4>(runtimeContext.get('id'));
      assertType<Weather>(runtimeContext.get('weather'));
      assertType<Time>(runtimeContext.get('time'));
    });

    // it('should raise a type error for keys not set', () => {
    //   // @ts-expect-error
    //   runtimeContext.get('non-existent-key');
    // });

    // it('should not raise an error for keys added later', () => {
    //   runtimeContext.set('new-key', 'value');
    //   runtimeContext.get('new-key');
    // });
  });

  describe('.keys()', () => {
    it('.keys() should allow type narrowing of values', () => {
      for (const key of runtimeContext.keys()) {
        assertType<string>(key);
        assertType<'id' | 'weather' | 'time'>(key);
        expectTypeOf(runtimeContext.get(key)).not.toBeAny();
        if (key === 'id') {
          assertType<UUIDv4>(runtimeContext.get(key));
        } else if (key === 'weather') {
          assertType<Weather>(runtimeContext.get(key));
        } else if (key === 'time') {
          assertType<Time>(runtimeContext.get(key));
        } else {
          assertType<never>(runtimeContext.get(key));
        }
      }
    });

    it('should narrow type to `never` once all set keys are ruled out', () => {
      for (const key of runtimeContext.keys()) {
        if (key != 'id' && key != 'weather' && key != 'time') {
          assertType<never>(runtimeContext.get(key));
        }
      }
    });
  });
  describe('.values()', () => {
    it('returns an iterator of the union of value types', () => {
      const values = runtimeContext.values();
      assertType<IterableIterator<UUIDv4 | Weather | Time>>(values);
      for (const value of values) {
        expectTypeOf(value).not.toBeAny();
      }
    });
  });

  describe('.entries()', () => {
    it('should allow type narrowing of values', () => {
      for (const [key, value] of runtimeContext.entries()) {
        expectTypeOf(value).not.toBeAny();
        if (key === 'id') {
          assertType<UUIDv4>(value);
        } else if (key === 'weather') {
          assertType<Weather>(value);
        } else if (key === 'time') {
          assertType<Time>(value);
        } else {
          assertType<never>(value);
        }
      }
    });

    it('should narrow type to `never` once all set keys are ruled out', () => {
      for (const [key, value] of runtimeContext.entries()) {
        if (key != 'id' && key != 'weather' && key != 'time') {
          assertType<never>(value);
        }
      }
    });
  });
});
