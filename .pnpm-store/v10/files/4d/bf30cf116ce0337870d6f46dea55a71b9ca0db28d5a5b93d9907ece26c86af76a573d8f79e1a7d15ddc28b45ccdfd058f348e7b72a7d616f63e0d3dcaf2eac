'use strict'

var tap = require('tap')
var test = tap.test
var sinon = require('sinon')
var shimmer = require('../index.js')

var outsider = 0
function counter () { return ++outsider }
function anticounter () { return --outsider }

var generator = {
  inc: counter
}
Object.defineProperty(generator, 'dec', {
  value: anticounter,
  writable: true,
  configurable: true,
  enumerable: false
})

test('should wrap safely', function (t) {
  t.plan(12)

  t.equal(counter, generator.inc, 'method is mapped to function')
  t.doesNotThrow(function () { generator.inc() }, 'original function works')
  t.equal(1, outsider, 'calls have side effects')

  var count = 0
  function wrapper (original, name) {
    t.equal(name, 'inc')
    return function () {
      count++
      var returned = original.apply(this, arguments)
      count++
      return returned
    }
  }
  shimmer.wrap(generator, 'inc', wrapper)

  t.ok(generator.inc.__wrapped, "function tells us it's wrapped")
  t.equal(generator.inc.__original, counter, 'original function is available')
  t.doesNotThrow(function () { generator.inc() }, 'wrapping works')
  t.equal(2, count, 'both pre and post increments should have happened')
  t.equal(2, outsider, 'original function has still been called')
  t.ok(generator.propertyIsEnumerable('inc'),
    'wrapped enumerable property is still enumerable')
  t.equal(Object.keys(generator.inc).length, 0,
    'wrapped object has no additional properties')

  shimmer.wrap(generator, 'dec', function (original) {
    return function () {
      return original.apply(this, arguments)
    }
  })

  t.ok(!generator.propertyIsEnumerable('dec'),
    'wrapped unenumerable property is still unenumerable')
})

test('wrap called with no arguments', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withExactArgs('no original function undefined to wrap')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.wrap()
  }, "wrapping with no arguments doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with module but nothing else', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withExactArgs('no original function undefined to wrap')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.wrap(generator)
  }, "wrapping with only 1 argument doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with original but no wrapper', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .twice()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.wrap(generator, 'inc')
  }, "wrapping with only original method doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with non-function original', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withExactArgs('original object and wrapper must be functions')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.wrap({ orange: 'slices' }, 'orange', function () {})
  }, "wrapping non-function original doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with non-function wrapper', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withArgs('original object and wrapper must be functions')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.wrap({ orange: function () {} }, 'orange', 'hamchunx')
  }, "wrapping with non-function wrapper doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})
