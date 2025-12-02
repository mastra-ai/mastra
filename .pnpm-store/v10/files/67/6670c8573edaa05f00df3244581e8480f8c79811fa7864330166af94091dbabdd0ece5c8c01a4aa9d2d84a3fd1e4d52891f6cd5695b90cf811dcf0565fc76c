[![Build Status](https://travis-ci.org/othiym23/shimmer.svg)](https://travis-ci.org/othiym23/shimmer)
[![Coverage Status](https://coveralls.io/repos/othiym23/shimmer/badge.svg?branch=master)](https://coveralls.io/r/othiym23/shimmer?branch=master)

## Safer monkeypatching for Node.js

`shimmer` does a bunch of the work necessary to wrap other methods in
a wrapper you provide:

```javascript
var http = require('http');
var shimmer = require('shimmer');

shimmer.wrap(http, 'request', function (original) {
  return function () {
    console.log("Starting request!");
    var returned = original.apply(this, arguments)
    console.log("Done setting up request -- OH YEAH!");
    return returned;
  };
});
```

### Mandatory disclaimer

There are times when it's necessary to monkeypatch default behavior in
JavaScript and Node. However, changing the behavior of the runtime on the fly
is rarely a good idea, and you should be using this module because you need to,
not because it seems like fun.

### API

All monkeypatched functions have an attribute, `__wrapped`, set to true on
them.

#### shimmer(options)

If you pass in an options object containing a function labeled `logger`,
`shimmer` will use it instead of the logger, which defaults to `console.error`.
`shimmer` is built to be as unobtrusive as possible and has no need to run
asynchronously, so it defaults to logging when things fail, instead of
throwing.

#### shimmer.wrap(nodule, name, wrapper)

`shimmer` monkeypatches in place, so it expects to be passed an object.
It accepts either instances, prototypes, or the results of calling
`require`. `name` must be the string key for the field's name on the
object.

`wrapper` is a function that takes a single parameter, which is the original
function to be monkeypatched. `shimmer` assumes that you're adding behavior
to the original method, and not replacing it outright. If you *are* replacing
the original function, feel free to ignore the passed-in function.

If you *aren't* discarding the original, remember these tips:

* call the original with something like `original.apply(this, arguments)`,
  unless your reason for monkeypatching is to transform the arguments.
* always capture and return the return value coming from the original function.
  Today's null-returning callback is tomorrow's error-code returning callback.
* Don't make an asynchronous function synchronous and vice versa.

#### shimmer.massWrap(nodules, names, wrapper)

Just like `wrap`, with the addition that you can wrap multiple methods on
multiple modules. Note that this function expects the list of functions to be
monkeypatched on all of the modules to be the same.

#### shimmer.unwrap(nodule, name)

A convenience function for restoring the function back the way it was before
you started. Won't unwrap if somebody else has monkeypatched the function after
you (but will log in that case). Won't throw if you try to double-unwrap a
function (but will log).

#### shimmer.massUnwrap(nodules, names)

Just like `unwrap`, with the addition that you can unwrap multiple methods on
multiple modules. Note that this function expects the list of functions to be
unwrapped on all of the modules to be the same.