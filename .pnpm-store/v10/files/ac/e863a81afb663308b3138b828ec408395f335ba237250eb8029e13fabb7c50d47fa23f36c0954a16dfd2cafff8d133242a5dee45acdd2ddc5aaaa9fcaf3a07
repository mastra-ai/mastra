# maybe

Maybe/Optional type implementation in Typescript.
Main motivation for creating this library was handling `null` values in deeply nested data, coming from GraphQL APIs, but the library itself is not limited to GraphQL.

Main idea behind this: we put all potentially `null`/`undefined` values in a special `Maybe` box and don't allow you to take it out, unless you tell what exactly should happen in `null`/`undefined` case. We also provide a couple of helper functions, which allow you to operate on `Maybe` boxes as if they were always defined. By chaining this operation you will almost always specify the code for happy-path only and still stay `null`-safe.

## Creating a maybe value

### `maybe(value)`

Takes a value which could potentially be `null` or `undefined` and returns a safe `Maybe` wrapper. These are all valid `maybe` calls:

```js
import { maybe } from '@sevinf/maybe';

maybe('foo');
maybe(false);
maybe(someObject);
maybe(() => alert('Hello!'));
maybe(null);
maybe(undefined);
```

Prevents double-wrapping the value. `maybe(foo)` and `maybe(maybe(foo))` return the same value.

### `some(value)`

Takes non-`null`/`undefined` value and returns a `Maybe` wrapper. These are all valid `some` calls:

```js
import { some } from '@sevinf/maybe';

some('foo');
some(false);
some(someObject);
some(() => alert('Hello!'));
```

These calls will throw exception in runtime:

```js
import { some } from '@sevinf/maybe';

some(null);
some(undefined);
```

Use it if are absolutely sure it is safe (for example, when passing the constant). In case your are not sure about nullability, use `maybe` instead.

### `none`

Constant, containing `Maybe` wrapper with no value inside. Safe equivalent of `null` value.

## Working with `Maybe` values

`Maybe` instances provide a couple of methods, which allow you to work on them in safe manner, regardless of whether or not they hold `some` or `none` values.

### `.map(fn: (a) => b): Maybe<b>`

This a main method for manipulating the data inside `Maybe` box. If wrapped value is `null` or `undefined`, does nothing and returns `none` value. Otherwise, calls provided `fn` function with unboxed value (which guaranteed to be non-null) and returns new `Maybe` box from return value of `fn`.

Couple of examples:

```js
import { maybe } from '@sevinf/maybe';

const five = maybe(5);
const ten = five.map(x => x + 5); // ten now holds number 10
const shout = five.map(x => `${x}!`); // shout holds string '5!'
const renderFive = five.map(x => <div>{x}</div>); // contains React element, rendering number 5

// all of these operations are also safe
const nothing = maybe(null);
const ten = nothing.map(x => x + 5); // ten holds nothing
const shout = nothing.map(x => `${x}!`); // shout holds nothing
const renderFive = nothing.map(x => <div>{x}</div>); // renderFive holds nothing
```

You can chain `.map` calls together:

```js
import { maybe } from '@sevinf/maybe';

function addFiveShoutAndRender(maybeValue) {
  return maybeValue
    .map(x => x + 5)
    .map(x => `${x}!`)
    .map(x => <div>${x}</div>);
}

addFiveShoutAndRender(maybe(5)); // returns maybe box, holding <div>10!</div>
addFiveShoutAndRender(maybe(null)); // returns maybe box, holding nothing
```

You can return `Maybe` values from the `fn` callback. In that case, resulting value will be flattened. You will never have `Maybe` value, wrapped in another `Maybe`:

```js
import { none, some } from '@sevinf/maybe';

function filterLow(x) {
  if (x > 100) {
    return some(x);
  }
  return none;
}
function shoutOver100(maybeValue) {
  return maybeValue.map(filterLow).map(x => `${x}!`);
}

addFiveShoutAndRender(maybe(9000)); // returns maybe box, holding string "9000!"
addFiveShoutAndRender(maybe(null)); // returns maybe box, holding nothing
addFiveShoutAndRender(maybe(5)); // returns maybe box, holding nothing
```

### `.get(key)`

Getting property of the object or array element is needed often enough so we provide a helper method for this. Functionally equivalent to `.map(value => value[key])`, but nicer to use in case of deeply nested data (for example, GraphQL data):

```js
import { maybe } from '@sevinf/maybe';

function hasMore(maybeAccount) {
  return maybeAccount
    .get('followers')
    .get('pageInfo')
    .get('hasMoreData');
}

hasMore(
  maybe({
    followers: {
      pageInfo: {
        hasMoreData: true
      }
    }
  })
); // returns Maybe box, holding `true` inside

// all those calls are safe and return boxes, containing nothing
hasMore(maybe(null));
hasMore(maybe({}));
hasMore(maybe({ followers: null }));
hasMore(maybe({ followers: {} }));
hasMore(
  maybe({
    followers: {
      pageInfo: null
    }
  })
);
hasMore(
  maybe({
    followers: {
      pageInfo: {}
    }
  })
);
```

Also works with arrays:

```js
import { maybe } from '@sevinf/maybe';

const safeArray = maybe(['foo', 'bar']);
safeArray.get(0); // returns Maybe<foo>
safeArray.get(100); // returns maybe, holding nothing
```

### `.isNone()`

Returns `true` if box holds nothing:

```js
import { maybe, none } from '@sevinf/maybe';

none.isNone(); // true
maybe(null).isNone(); // true
maybe(undefined).isNone(); // true

maybe('foo').isNone(); // false
maybe(false).isNone(); // false
maybe(0).isNone(); // false
```

## Getting the value out of the `Maybe`

So far, we learned how to create a `Maybe` value and learned to operate on it in a safe way. It is recommended that you'll pass `Maybe` values around, use `.map` functions and keep values boxes for as long as possible: that way your are safely protected from null pointer exceptions. However, at some point you'll have to get the value out: you can't send `Maybe` to react or renderer or your backend server. In that case, `Maybe` type requires you to explicitly specify what to do in `none` case. It provides a bunch of instance methods for different scenarios.

### `.orElse(fallback)`

Returns boxed value if it is set and provided `fallback` value otherwise:

```js
import { maybe } from '@sevinf/maybe';

maybe(5).orElse(0); // returns 5
maybe(null).orElse(0); // returns 0
maybe(undefined).orElse(0); // returns 0

maybe({ foo: 5 })
  .get('foo')
  .orElse(0); // returns 5
maybe({ foo: 5 })
  .get('bar')
  .orElse(0); // returns 0
```

### `.orCall(getFallback: () => fallback)`

Returns boxed value if it is set. If it is not, calls provided `getFallback` function and returns its return value. Can be used instead of `.orElse` if computing fallback value is expensive.

```js
// computeExpensiveFallbackValue won't be called unless it is really needed
someMaybeValue.orCall(() => computeExpensiveFallbackValue());
```

### `.orNull()`

Returns boxed value if it is set and `null` otherwise. Use with caution: you are responsible for `null`-safety on your own after this! Generally, prefer `.orElse` and `.orCall` methods, use `.orNull` only if you absolutely have to.

### `.orThrow(message: ?string)`

Returns boxed value if it is set and throws `TypeError` otherwise. Use only when you are absolutely sure that there is a value inside `Maybe`.

```js
import { maybe } from '@sevinf/maybe';

maybe(5).orThrow(); // returns 5
maybe(null).orThrow(); // throws TypeError with default message
maybe(undefined).orThrow('This should never happen'); // throws TypeError with custom message
```

## Helper functions

Library provides a number of helper functions for common scenarios:

### `first(items: Maybe[]): Maybe`

Returns the first item in `items`, which holds any value. Returns `none` if all `items` are `none` or the list is empty. Useful for the cases of multiple different fallbacks. Suppose we have an account. We want to display account's nickname, full name or login, whichever is set. If nothing is set, we want to fallback to default message:

```js
import { first } from '@sevinf/maybe';

function getDisplayName(maybeAccount) {
  return first([
    maybeAccount.get('nickname'),
    maybeAccount.get('fullName'),
    maybeAccount.get('login')
  ]).orElse('Unknown User');
}
```

### `all(items: Maybe[]): Maybe`

Accepts array of `Maybe` values. If every value in array holds something, return `Maybe`, holding the array of unboxed values. If at least one value is `none`, returns `none`. Useful when you have several required fields and want to do something only when they are all set. For example, you want display account info only when account has both full name and profile picture. If any of those fields are missing, you want to display nothing at all:

```js
import { all } from '@sevinf/maybe';

function verifyAccount(maybeAccount) {
  return all([
    maybeAccount.get('fullName'),
    maybeAccount.get('profilePicture')
  ]).map(([fullName, profilePicture]) => {
    // do something with `fullName` and `profilePicture`, they
    // are both non-null here
  });
}
```

### `allProperties(object): Maybe`

Equivalent to `all`, only operates on objects properties instead of array items.

```js
import { allProperties } from '@sevinf/maybe';

function verifyAccount(maybeAccount) {
  return allProperties({
    name: maybeAccount.get('fullName'),
    picture: maybeAccount.get('profilePicture')
  }).map(verifiedAccount => {
    // all properties of `verifiedAccount` (name and picture) are
    // non-null here
  });
}
```

You can also mix `Maybe` and non-`Maybe` properties:

```js
import { allProperties } from '@sevinf/maybe';

function verifyAccount(maybeAccount) {
  return allProperties({
    id: 'foo'
    name: maybeAccount.get('fullName'),
    picture: maybeAccount.get('profilePicture')
  }).map(verifiedAccount => {
    // verifiedAccount has non-null `id`, `name` and `picture` properties
  });
}
```

### `compact(items)`

Accepts array of `Maybe` values. Filters out all `none` values and unboxes the rest. Useful for filtering out unwanted items from the lists. Suppose, we have an array of accounts and we want to have only those items, which pass `verifyAccount` check from previous example:

```js
import { compact } from '@sevinf/maybe';

function getValidAccounts(accountList) {
  return compact(accountList.map(verifyAccount));
}
```
