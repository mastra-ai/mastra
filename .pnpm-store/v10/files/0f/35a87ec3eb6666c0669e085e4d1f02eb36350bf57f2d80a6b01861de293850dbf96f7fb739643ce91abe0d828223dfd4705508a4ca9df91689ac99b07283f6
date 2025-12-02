
# temporal-polyfill

A lightweight polyfill for [Temporal](https://tc39.es/proposal-temporal/docs/), successor to the JavaScript `Date` object

Only 20 kB, [spec compliant](#spec-compliance)


## Table of Contents

- [Installation](#installation)
- [Comparison with `@js-temporal/polyfill`](#comparison-with-js-temporalpolyfill)
- [Spec Compliance](#spec-compliance)
- [Browser Support](#browser-support)
- [BigInt Considerations](#bigint-considerations)
- [Tree-shakable API](#tree-shakable-api) (coming soon)


## Installation

```
npm install temporal-polyfill
```

Import as an ES module without side effects:

```js
import { Temporal } from 'temporal-polyfill'

console.log(Temporal.Now.zonedDateTimeISO().toString())
```

Or, import globally:

```js
import 'temporal-polyfill/global'

console.log(Temporal.Now.zonedDateTimeISO().toString())
```

Use a `<script>` tags with a CDN link:

```html
<script src='https://cdn.jsdelivr.net/npm/temporal-polyfill@0.2.5/global.min.js'></script>
<script>
  console.log(Temporal.Now.zonedDateTimeISO().toString())
</script>
```


## Comparison with `@js-temporal/polyfill`

<table>
  <tr>
    <td>Package</td>
    <td>
      <code>temporal-polyfill</code>
    </td>
    <td>
      <code>@js-temporal/polyfill</code>
    </td>
  </tr>
  <tr>
    <td>Repo</td>
    <td>
      <a href='https://github.com/fullcalendar/temporal-polyfill'>
        fullcalendar/temporal-polyfill
      </a>
    </td>
    <td>
      <a href='https://github.com/js-temporal/temporal-polyfill'>
        js-temporal/temporal-polyfill
      </a>
    </td>
  </tr>
  <tr>
    <td>Creators</td>
    <td><a href='https://fullcalendar.io/'>FullCalendar</a> lead dev <a href='https://github.com/arshaw'>arshaw</a></td>
    <td>Champions of the <a href='https://github.com/tc39/proposal-temporal'>Temporal proposal</a></td>
  </tr>
  <tr>
    <td>Minified+gzip size</td>
    <td><a href='https://bundlephobia.com/package/temporal-polyfill'>20 KB<a></td>
    <td><a href='https://bundlephobia.com/package/@js-temporal/polyfill'>56 KB</a> (+180%)</td>
  </tr>
  <tr>
    <td>Spec compliance</td>
    <td>
      Strict compliance for built-in types.<br />
      Relaxed compliance for subclassing<br />built-in types.
    </td>
    <td>
      Strict compliance for entire API.
    </td>
  </tr>
  <tr>
    <td>Spec date</td>
    <td>
      Apr 2024
    </td>
    <td>
      May 2023
    </td>
  </tr>
  <tr>
    <td>BigInt approach</td>
    <td>Internally avoids BigInt operations altogether</td>
    <td>Internally relies on <a href='https://github.com/GoogleChromeLabs/jsbi'>JSBI</a></td>
  </tr>
  <tr>
    <td>Global usage in ESM</td>
    <td>
      <code>import 'temporal-polyfill/global'</code>
    </td>
    <td>Not currently possible</td>
  </tr>
</table>


## Spec Compliance

All calendar systems (ex: `chinese`, `persian`) and all time zones are supported.

Compliance with the latest version of the Temporal spec (Apr 2024) is near-perfect with the following intentional deviations:

- *Custom implementations* of Calendars and TimeZones are queried differently. Only affects those subclassing built-in classes, which is extremely rare. See the CALLING entries in the [test-skip file](https://github.com/fullcalendar/temporal/blob/main/packages/temporal-polyfill/scripts/test262-config/expected-failures.txt).
- There are believed to be 3 bugs in the Temporal spec itself. See SPEC-BUG entries in the [test-skip file](https://github.com/fullcalendar/temporal/blob/main/packages/temporal-polyfill/scripts/test262-config/expected-failures.txt).
- `Intl.DateTimeFormat` has not been polyfilled to accept number-offset values for the `timeZone` option.
- Method descriptors and `Function::length` are not strictly compliant due to ES-related space-saving techniques.

The [Official ECMAScript Conformance Test Suite](https://github.com/tc39/test262) has:

- 7102 *total* Temporal-related test files
- 6477 *passed* by `temporal-polyfill`
- 491 *skipped* due to superficial method descriptor non-compliance
- 134 *skipped* due to other aforementioned intentional deviations


## Browser Support

<table>
  <tr>
    <td colspan='6'>
      <strong>Minimum required browsers for ISO/gregory calendars:</strong>
    </td>
  </tr>
  <tr>
    <!-- Computed from Libraries+Syntax in worksheet below  -->
    <td>Chrome 60<br />(Jul 2017)</td>
    <td>Firefox 55<br />(Aug 2017)</td>
    <td>Safari 11.1<br />(Mar 2018)</td>
    <td>Safari iOS 11.3<br />(Mar 2018)</td>
    <td>Edge 79<br />(Jan 2020)</td>
    <td>Node.js 14<br />(Apr 2020)</td>
  </tr>
  <tr>
    <td colspan='6'>
      <br />
      <strong>If you transpile, you can support older browsers down to:</strong>
    </td>
  </tr>
  <tr>
    <!-- Computed from Libraries in worksheet below  -->
    <td>Chrome 57<br />(Mar 2017)</td>
    <td>Firefox 52<br />(Mar 2017)</td>
    <td>Safari 10<br />(Sep 2016)</td>
    <td>Safari iOS 10<br />(Sep 2016)</td>
    <td>Edge 15<br />(Apr 2017)</td>
    <td>Node.js 14<br />(Apr 2020)</td>
  </tr>
  <tr>
    <td colspan='6'>
      <br />
      <strong>For non-ISO/gregory calendars, requirements are higher:</strong>
    </td>
  </tr>
  <tr>
    <!-- https://caniuse.com/mdn-javascript_builtins_intl_datetimeformat_datetimeformat_options_parameter_options_calendar_parameter -->
    <td>Chrome 80<br />(Feb 2020)</td>
    <td>Firefox 76<br />(May 2020)</td>
    <td>Safari 14.1<br />(Apr 2021)</td>
    <td>Safari iOS 14.5<br />(Apr 2021)</td>
    <td>Edge 80<br />(Feb 2020)</td>
    <td>Node.js 14<br />(Apr 2020)</td>
  </tr>
</table>

<!--
## Browser Support Worksheet

Use caniuse's star feature to find intersection of features.

Libraries:
- [Intl.DateTimeFormat IANA time zone names](https://caniuse.com/mdn-javascript_builtins_intl_datetimeformat_datetimeformat_options_parameter_options_timezone_parameter_iana_time_zones)
- [Number.isInteger](https://caniuse.com/mdn-javascript_builtins_number_isinteger)
- [Number.isSafeInteger] (https://caniuse.com/mdn-javascript_builtins_number_issafeinteger)
- [String::padStart](https://caniuse.com/mdn-javascript_builtins_string_padstart)
- [WeakMap](https://caniuse.com/mdn-javascript_builtins_weakmap)

Syntax:
- [Classes](https://caniuse.com/es6-class)
- [Exponentiation](https://caniuse.com/mdn-javascript_operators_exponentiation)
- [Spread in array literals](https://caniuse.com/mdn-javascript_operators_spread_spread_in_arrays)
- [Spread in function calls](https://caniuse.com/mdn-javascript_operators_spread_spread_in_function_calls)
- [Spread in object literals](https://caniuse.com/mdn-javascript_operators_spread_spread_in_object_literals)

BigInt (https://caniuse.com/bigint):
- Chrome 67 (May 2018)
- Firefox 68 (Jul 2019)
- Safari 14 (Sep 2020)
- Safari iOS 14 (Sep 2020)
- Edge 79 (Jan 2020)

Node.js is always 14 because the test-runner doesn't work with lower
-->


## BigInt Considerations

This polyfill does NOT depend on [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) support. Internally, no operations leverage BigInt arithmetics. :thumbsup:

However, if you plan to use methods that accept/emit BigInts, your environment must support it. Alternatively, you can avoid using these methods altogether. [There's a cheatsheet](https://gist.github.com/arshaw/1ef4bf945d68654b86cef2dd8471c48f) to help you.


## Tree-shakable API

🚧 Coming Soon

For library authors and other devs who are hyper-concerned about bundle size, `temporal-polyfill` will be providing an alternate API designed for tree-shaking.

```js
import * as ZonedDateTime from 'temporal-polyfill/fns/zoneddatetime'

const zdt = ZonedDateTime.from({ year: 2024, month: 1, day: 1 })
const s = ZonedDateTime.toString(zdt) // not how you normally call a method!
```
