/**
 * Side-effect import: formats dates and numbers as en-US whenever the code
 * under test passes no locale. Node picks its default locale from LANG once,
 * at startup, so a test cannot switch it at runtime; this keeps locale-sensitive
 * assertions independent of the developer's machine.
 *
 * Import it FIRST in the test file, so modules that build formatters at load
 * time (e.g. `const fmt = new Intl.DateTimeFormat(undefined, …)`) see it.
 */
import { afterAll } from 'vitest';

const LOCALE = 'en-US';

const intlConstructors = ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'ListFormat'] as const;

const localeMethods = [
  [Date.prototype, 'toLocaleString'],
  [Date.prototype, 'toLocaleDateString'],
  [Date.prototype, 'toLocaleTimeString'],
  [Number.prototype, 'toLocaleString'],
] as const;

type LocaleArgs = [locales?: Intl.LocalesArgument, options?: object];
type LocaleMethod = (this: unknown, ...args: LocaleArgs) => string;

const restores: Array<() => void> = [];

function override(target: object, name: string, wrap: (original: unknown) => unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(target, name);
  if (!descriptor) throw new Error(`english-locale: ${name} is missing`);
  Object.defineProperty(target, name, { ...descriptor, value: wrap(descriptor.value) });
  restores.push(() => Object.defineProperty(target, name, descriptor));
}

for (const name of intlConstructors) {
  override(
    Intl,
    name,
    Original =>
      class extends (Original as new (...args: LocaleArgs) => object) {
        constructor(...[locales, options]: LocaleArgs) {
          super(locales ?? LOCALE, options);
        }
      },
  );
}

for (const [target, name] of localeMethods) {
  override(
    target,
    name,
    original =>
      function (this: unknown, ...[locales, options]: LocaleArgs) {
        return (original as LocaleMethod).call(this, locales ?? LOCALE, options);
      },
  );
}

afterAll(() => {
  for (const restore of restores.splice(0).reverse()) restore();
});
