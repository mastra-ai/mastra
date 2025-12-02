/**
Delay the promise for the given duration.

@example
```
import {delay} from 'unicorn-magic';

await delay({seconds: 1});

console.log('1 second later');
```
*/
export function delay(duration: {seconds: number} | {milliseconds: number}): Promise<void>;

/**
Convert a `URL` or path to a path.

**Not available in browsers.**

@example
```
import path from 'node:path';
import {toPath} from 'unicorn-magic';

// `cwd` can be `URL` or a path string.
const getUnicornPath = cwd => path.join(toPath(cwd), 'unicorn');
```
*/
export function toPath(urlOrPath: URL | string): string;
