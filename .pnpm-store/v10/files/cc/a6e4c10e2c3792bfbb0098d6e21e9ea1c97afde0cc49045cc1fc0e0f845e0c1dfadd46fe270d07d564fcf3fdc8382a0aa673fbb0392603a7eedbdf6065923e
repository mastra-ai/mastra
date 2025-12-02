<img src="https://avatars2.githubusercontent.com/u/2810941?v=3&s=96" alt="Google Cloud Platform logo" title="Google Cloud Platform" align="right" height="96" width="96"/>

# @google-cloud/precise-date
> A simple utility for precise-dateing functions and classes.

### Installing the package

It's unlikely you will need to install this package directly, as it will be
installed as a dependency when you install other `@google-cloud` packages.

```sh
$ npm install --save @google-cloud/precise-date
```

### Using the package

`PreciseDate` extends the native `Date` object, so you can use it in place of
that or when you need nanosecond precision.

```js
const {PreciseDate} = require('@google-cloud/precise-date');
const date = new PreciseDate('1547253035381101032');

date.toISOString();
// => 2019-01-12T00:30:35.381101032Z

date.toFullTimeString();
// => '1547253035381101032'
```

## API

### PreciseDate([time])

Returns a new `date` instance.

#### time

Type: `string` [`BigInt`][big_int] `Object<string, number>` `[number, number]`

```js
// from a full ISO string
date = new PreciseDate('2019-02-08T10:34:29.481145231Z');

// from a string representing nanoseconds
date = new PreciseDate('1549622069481320032');

// from a BigInt representing nanoseconds (requires Node >= 10.7)
date = new PreciseDate(1549622069481320032n);

// from an object containing `seconds` and `nanos` values
date = new PreciseDate({seconds: 1549622069, nanos: 481320032});

// from a tuple representing [seconds, nanos]
date = new PreciseDate([1549622069, 481320032]);
```

#### PreciseDate.parseFull(time)

Similar to [`Date.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse), but this accepts the same nanosecond time options as the `PreciseDate` constructor and returns a string representing the nanoseconds in the specified date according to universal time.

```js
PreciseDate.parseFull('2019-02-08T10:34:29.481145231Z');
// => '1549622069481145231'
```

#### PreciseDate.fullUTCString(...dateFields)

Similar to [`Date.UTC()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC), but also accepts microsecond and nanosecond parameters. Returns a string that represents the number of nanoseconds since January 1, 1970, 00:00:00 UTC.

##### dateFields

Type: `...number`

```js
PreciseDate.fullUTCString(2019, 1, 8, 10, 34, 29, 481, 145, 231);
// => '1549622069481145231'
```

#### PreciseDate.fullUTC(...dateFields)

Like `PreciseDate.fullUTCString()` but returns a native [`BigInt`][big_int] instead of a string. **Requires Node >= 10.7.**

##### dateFields

Type: `...number`

```js
PreciseDate.fullUTC(2019, 1, 8, 10, 34, 29, 481, 145, 231);
// => 1549622069481145231n
```

### date

`PreciseDate` instance.

#### date.getFullTimeString()

Returns a string of the specified date represented in nanoseconds according to universal time.

#### date.getFullTime()

Like `date.getFullTimeString()` but returns a native [`BigInt`][big_int] instead of a string. **Requires Node >= 10.7.**

#### date.getMicroseconds()

Returns the microseconds in the specified date according to universal time.

#### date.getNanoseconds()

Returns the nanoseconds in the specified date according to universal time.

#### date.setMicroseconds(microseconds)

Sets the microseconds for a specified date according to universal time. Returns a string representing the nanoseconds in the specified date according to universal time.

##### microseconds

Type: `number`

#### date.setNanoseconds(nanoseconds)

Sets the nanoseconds for a specified date according to universal time. Returns a string representing the nanoseconds in the specified date according to universal time.

##### nanoseconds

Type: `number`

#### date.setFullTime(time)

Sets the time to the number of supplied nanoseconds since January 1, 1970, 00:00:00 UTC. Returns a string representing the nanoseconds in the specified date according to universal time (effectively, the value of the argument).

##### time

Type: `number` `string` [`BigInt`][big_int]

#### date.toStruct()

Returns an object representing the specified date according to universal time.
Refer to [`google.protobuf.Timestamp`](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#timestamp|google.protobuf.Timestamp) for more information about this format.

```js
const {seconds, nanos} = date.toStruct();
```

#### date.toTuple()

Like `date.toStruct()` but returns the `seconds` and `nanos` as a tuple.

```js
const [seconds, nanos] = date.toTuple();
```

[big_int]: https://github.com/tc39/proposal-bigint

## Versioning

This library follows [Semantic Versioning](http://semver.org/).

## Contributing

Contributions welcome! See the [Contributing Guide](https://github.com/googlecloudplatform/google-cloud-node/blob/master/.github/CONTRIBUTING.md).

## License

Apache Version 2.0

See [LICENSE](https://github.com/googlecloudplatform/google-cloud-node/blob/master/LICENSE)
