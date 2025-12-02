<div align="center">
  <a href="https://www.npmjs.com/package/use-debounce">
    <img src="logo.png" width="500" alt="use-debounce" />
  </a>
</div>

<div align="center">
  <a href="https://www.npmjs.com/package/use-debounce">
    <img alt="npm" src="https://img.shields.io/npm/v/use-debounce.svg?labelColor=49516F&color=8994BC" />
  </a>
  <a href="https://npmjs.org/package/use-debounce">
    <img alt="downloads" src="https://badgen.net/npm/dm/use-debounce?labelColor=49516F&color=8994BC" />
  </a>
  <a href="https://bundlephobia.com/result?p=use-debounce">
    <img alt="tree-shakeable" src="https://badgen.net/bundlephobia/tree-shaking/use-debounce?labelColor=49516F&color=8994BC" />
  </a>
  <a href="https://npmjs.org/package/use-debounce">
    <img alt="types included" src="https://badgen.net/npm/types/use-debounce?labelColor=49516F&color=8994BC" />
  </a>
</div>

# useDebounce, useDebouncedCallback & useThrottledCallback

React libraries for debouncing without tears!

- Small size < 1 Kb
- Compatible with underscore / lodash impl — learn once, use everywhere
- Server-rendering friendly!

## Features

- [classic debounced callback](#debounced-callbacks)
- [**value** debouncing](#simple-values-debouncing)
- [cancel, maxWait and memoization](#advanced-usage)

## Install

```sh
yarn add use-debounce
# or
npm i use-debounce --save
```

## Copy paste guidance:

### use-debounce

Simple usage: https://codesandbox.io/s/kx75xzyrq7

Debounce HTTP request: https://codesandbox.io/s/rr40wnropq

Debounce HTTP request with `leading` param: https://codesandbox.io/s/cache-example-with-areas-and-leading-param-119r3i

### use-debounce callback

Simple usage: https://codesandbox.io/s/x0jvqrwyq

Combining with native event listeners: https://codesandbox.io/s/32yqlyo815

Cancelling, maxWait and memoization: https://codesandbox.io/s/4wvmp1xlw4

HTTP requests: https://codesandbox.io/s/use-debounce-callback-http-y1h3m6

## Changelog

https://github.com/xnimorz/use-debounce/blob/master/CHANGELOG.md

## Simple values debouncing

According to https://twitter.com/dan_abramov/status/1060729512227467264
WebArchive link: https://web.archive.org/web/20210828073432/https://twitter.com/dan_abramov/status/1060729512227467264

```javascript
import React, { useState } from 'react';
import { useDebounce } from 'use-debounce';

export default function Input() {
  const [text, setText] = useState('Hello');
  const [value] = useDebounce(text, 1000);

  return (
    <div>
      <input
        defaultValue={'Hello'}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <p>Actual value: {text}</p>
      <p>Debounce value: {value}</p>
    </div>
  );
}
```

This hook compares prev and next value using shallow equal. It means, setting an object `{}` will trigger debounce timer. If you have to compare objects (https://github.com/xnimorz/use-debounce/issues/27#issuecomment-496828063), you can use `useDebouncedCallback`, that is explained below:

## Debounced callbacks

Besides `useDebounce` for values you can debounce callbacks, that is the more commonly understood kind of debouncing.
Example with Input (and react callbacks): https://codesandbox.io/s/x0jvqrwyq

```js
import { useDebouncedCallback } from 'use-debounce';

function Input({ defaultValue }) {
  const [value, setValue] = useState(defaultValue);
  // Debounce callback
  const debounced = useDebouncedCallback(
    // function
    (value) => {
      setValue(value);
    },
    // delay in ms
    1000
  );

  // you should use `e => debounced(e.target.value)` as react works with synthetic events
  return (
    <div>
      <input
        defaultValue={defaultValue}
        onChange={(e) => debounced(e.target.value)}
      />
      <p>Debounced value: {value}</p>
    </div>
  );
}
```

Example with Scroll (and native event listeners): https://codesandbox.io/s/32yqlyo815

```js
function ScrolledComponent() {
  // just a counter to show, that there are no any unnessesary updates
  const updatedCount = useRef(0);
  updatedCount.current++;

  const [position, setPosition] = useState(window.pageYOffset);

  // Debounce callback
  const debounced = useDebouncedCallback(
    // function
    () => {
      setPosition(window.pageYOffset);
    },
    // delay in ms
    800
  );

  useEffect(() => {
    const unsubscribe = subscribe(window, 'scroll', debounced);
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div style={{ height: 10000 }}>
      <div style={{ position: 'fixed', top: 0, left: 0 }}>
        <p>Debounced top position: {position}</p>
        <p>Component rerendered {updatedCount.current} times</p>
      </div>
    </div>
  );
}
```

### Returned value from `debounced()`

Subsequent calls to the debounced function `debounced` return the result of the last func invocation.
Note, that if there are no previous invocations it's mean you will get undefined. You should check it in your code properly.

Example:

```javascript
it('Subsequent calls to the debounced function `debounced` return the result of the last func invocation.', () => {
  const callback = jest.fn(() => 42);

  let callbackCache;
  function Component() {
    const debounced = useDebouncedCallback(callback, 1000);
    callbackCache = debounced;
    return null;
  }
  Enzyme.mount(<Component />);

  const result = callbackCache();
  expect(callback.mock.calls.length).toBe(0);
  expect(result).toBeUndefined();

  act(() => {
    jest.runAllTimers();
  });
  expect(callback.mock.calls.length).toBe(1);
  const subsequentResult = callbackCache();

  expect(callback.mock.calls.length).toBe(1);
  expect(subsequentResult).toBe(42);
});
```

### Advanced usage

#### Cancel, maxWait and memoization

1. Both `useDebounce` and `useDebouncedCallback` works with `maxWait` option. This params describes the maximum time func is allowed to be delayed before it's invoked.
2. You can cancel debounce cycle, by calling `cancel` callback

The full example you can see here https://codesandbox.io/s/4wvmp1xlw4

```javascript
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useDebouncedCallback } from 'use-debounce';

function Input({ defaultValue }) {
  const [value, setValue] = useState(defaultValue);
  const debounced = useDebouncedCallback(
    (value) => {
      setValue(value);
    },
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 2000 }
  );

  // you should use `e => debounced(e.target.value)` as react works with synthetic events
  return (
    <div>
      <input
        defaultValue={defaultValue}
        onChange={(e) => debounced(e.target.value)}
      />
      <p>Debounced value: {value}</p>
      <button onClick={debounced.cancel}>Cancel Debounce cycle</button>
    </div>
  );
}

const rootElement = document.getElementById('root');
ReactDOM.render(<Input defaultValue="Hello world" />, rootElement);
```

The same API is available for `useDebounce` calls:
```js
const [value, {cancel, isPending, flush}] = useDebounce(valueToDebounce);
...
cancel() // cancels pending debounce request
isPending() // returns if there is a pending debouncing request
flush() // immediately flushes pending request
```


#### Flush method

`useDebouncedCallback` has `flush` method. It allows to call the callback manually if it hasn't fired yet. This method is handy to use when the user takes an action that would cause the component to unmount, but you need to execute the callback.

```javascript
import React, { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

function InputWhichFetchesSomeData({ defaultValue, asyncFetchData }) {
  const debounced = useDebouncedCallback(
    (value) => {
      asyncFetchData;
    },
    500,
    { maxWait: 2000 }
  );

  // When the component goes to be unmounted, we will fetch data if the input has changed.
  useEffect(
    () => () => {
      debounced.flush();
    },
    [debounced]
  );

  return (
    <input
      defaultValue={defaultValue}
      onChange={(e) => debounced(e.target.value)}
    />
  );
}
```

#### isPending method

`isPending` method shows whether component has pending callbacks. Works for both `useDebounce` and `useDebouncedCallback`:

```javascript
import React, { useCallback } from 'react';

function Component({ text }) {
  const debounced = useDebouncedCallback(
    useCallback(() => {}, []),
    500
  );

  expect(debounced.isPending()).toBeFalsy();
  debounced();
  expect(debounced.isPending()).toBeTruthy();
  debounced.flush();
  expect(debounced.isPending()).toBeFalsy();

  return <span>{text}</span>;
}
```

#### leading/trailing calls

Both `useDebounce` and `useDebouncedCallback` work with the `leading` and `trailing` options. `leading` param will execute the function once immediately when called. Subsequent calls will be debounced until the timeout expires. `trailing` option controls whenever to call the callback after timeout again.

For more information on how leading debounce calls work see: https://lodash.com/docs/#debounce

```javascript
import React, { useState } from 'react';
import { useDebounce } from 'use-debounce';

export default function Input() {
  const [text, setText] = useState('Hello');
  const [value] = useDebounce(text, 1000, { leading: true });

  // value is updated immediately when text changes the first time,
  // but all subsequent changes are debounced.
  return (
    <div>
      <input
        defaultValue={'Hello'}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <p>Actual value: {text}</p>
      <p>Debounce value: {value}</p>
    </div>
  );
}
```

#### Options:

You can provide additional options as a third argument to both `useDebounce` and `useDebouncedCallback`:

| option     | default                       | Description                                                                                                                      | Example                                                                |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| maxWait    | -                             | Describes the maximum time func is allowed to be delayed before it's invoked                                                     | https://github.com/xnimorz/use-debounce#cancel-maxwait-and-memoization |
| leading    | -                             | This param will execute the function once immediately when called. Subsequent calls will be debounced until the timeout expires. | https://github.com/xnimorz/use-debounce#leading-calls                  |
| trailing   | true                          | This param executes the function after timeout.                                                                                  | https://github.com/xnimorz/use-debounce#leading-calls                  |
| equalityFn | (prev, next) => prev === next | [useDebounce ONLY] Comparator function which shows if timeout should be started                                                  |                                                                        |

## useThrottledCallback

You are able to use throttled callback with this library also (starting 5.2.0 version).
For this purpose use:

```
import useThrottledCallback from 'use-debounce/useThrottledCallback';
```

or

```
import { useThrottledCallback } from 'use-debounce';
```

Several examples:

1. Avoid excessively updating the position while scrolling.

   ```js
   const scrollHandler = useThrottledCallback(updatePosition, 100);
   window.addEventListener('scroll', scrollHandler);
   ```

2. Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
   ```js
   const throttled = useThrottledCallback(renewToken, 300000, { 'trailing': false })
   <button onClick={throttled}>click</button>
   ```

All the params for `useThrottledCallback` are the same as for `useDebouncedCallback` except `maxWait` option. As it's not needed for throttle callbacks.

# Special thanks:

[@tryggvigy](https://github.com/tryggvigy) — for managing lots of new features of the library like trailing and leading params, throttle callback, etc;

[@omgovich](https://github.com/omgovich) — for reducing bundle size.
