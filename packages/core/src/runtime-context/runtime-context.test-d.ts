import { beforeEach, describe, it, expectTypeOf, assertType } from 'vitest';
import { RuntimeContext } from '.';

type UUIDv4 = `${string}-${string}-${string}-${string}-${string}`;
type TemperatureScale = 'celsius' | 'fahrenheit';
type Weather = {
  scale: TemperatureScale;
  temperature: number;
};
type Time = `${number}:${number} ${'AM' | 'PM'}`;

type TestRuntimeContext = {
  id: UUIDv4;
  weather: Weather;
  time: Time;
};

const exampleUUID: UUIDv4 = '1e5efda9-7ead-455a-bd69-6e49631973db';
const exampleWeather = Object.freeze({ scale: 'celsius', temperature: 22 });
const exampleTime: Time = '10:45 AM';

let runtimeContext: RuntimeContext<TestRuntimeContext>;
beforeEach(() => {
  runtimeContext = new RuntimeContext<TestRuntimeContext>();
});

describe('Runtime Context Types', () => {
  describe('.set()', () => {
    it('should allow values with the right types', () => {
      runtimeContext.set('id', exampleUUID);
      runtimeContext.set('weather', exampleWeather);
      runtimeContext.set('time', exampleTime);
    });

    it('should forbid passing other types', () => {
      // @ts-expect-error
      runtimeContext.set('id', 'exampleUUID');
      // @ts-expect-error
      runtimeContext.set('weather', { scale: 'kelvin', temperature: 22 });
      // @ts-expect-error
      runtimeContext.set('weather', { scale: 'celsius', temperature: '22' });
      // @ts-expect-error
      runtimeContext.set('time', '10:00 UTC');
    });

    it('should forbid setting properties not in the type', () => {
      // @ts-expect-error
      runtimeContext.set('name', 'test name');
      // @ts-expect-error
      runtimeContext.set('temperature', '22');
    });
  });

  describe('.get()', () => {});

  it('.keys() should allow type narrowing of values', () => {
    for (const key of runtimeContext.keys()) {
      assertType<UUIDv4 | Weather | Time>(runtimeContext.get(key));
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

  it('.values() returns an iterator of the union of value types', () => {
    const values = runtimeContext.values();
    assertType<IterableIterator<UUIDv4 | Weather | Time>>(values);
    for (const value of values) {
      // @ts-expect-error
      assertType<null>(runtimeContext.get(key));
    }
  });

  it('.entries() should allow type narrowing of values', () => {
    for (const [key, value] of runtimeContext.entries()) {
      // @ts-expect-error
      assertType<number>(value);
      if (key === 'id') {
        assertType<UUIDv4>(value);
      } else if (key === 'weather') {
        assertType<Weather>(value);
      } else if (key === 'time') {
        assertType<Time>(value);
      } else {
        assertType<never>(runtimeContext.get(key));
      }
    }
  });
});
