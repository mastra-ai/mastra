'use strict'

var tap = require('tap')
var test = tap.test
var sinon = require('sinon')
var shimmer = require('../index.js')

var outsider = 0
function counter () { return ++outsider }
function anticounter () { return --outsider }

var generator = {
  inc: counter,
  dec: anticounter
}

var arrow = {
  in: counter,
  out: anticounter
}

var nester = {
  in: counter,
  out: anticounter
}

test('should wrap multiple functions safely', function (t) {
  t.plan(9)

  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.equal(anticounter, generator.dec, 'basic function equality testing should work')
  t.doesNotThrow(function () { generator.inc() })
  t.doesNotThrow(function () { generator.dec() })
  t.equal(0, outsider, 'calls have side effects')

  var count = 0
  function wrapper (original) {
    return function () {
      count++
      var returned = original.apply(this, arguments)
      count++
      return returned
    }
  }
  shimmer.massWrap(generator, ['inc', 'dec'], wrapper)

  t.doesNotThrow(function () { generator.inc() })
  t.doesNotThrow(function () { generator.dec() })
  t.equal(4, count, 'both pre and post increments should have happened')
  t.equal(0, outsider, 'original function has still been called')
})

test('should wrap multiple functions on multiple modules safely', function (t) {
  t.plan(15)

  t.equal(counter, arrow.in, 'basic function equality testing should work')
  t.equal(counter, nester.in, 'basic function equality testing should work')
  t.equal(anticounter, arrow.out, 'basic function equality testing should work')
  t.equal(anticounter, nester.out, 'basic function equality testing should work')

  t.doesNotThrow(function () { arrow.in() })
  t.doesNotThrow(function () { nester.in() })
  t.doesNotThrow(function () { arrow.out() })
  t.doesNotThrow(function () { nester.out() })

  t.equal(0, outsider, 'calls have side effects')

  var count = 0
  function wrapper (original) {
    return function () {
      count++
      var returned = original.apply(this, arguments)
      count++
      return returned
    }
  }
  shimmer.massWrap([arrow, nester], ['in', 'out'], wrapper)

  t.doesNotThrow(function () { arrow.in() })
  t.doesNotThrow(function () { arrow.out() })
  t.doesNotThrow(function () { nester.in() })
  t.doesNotThrow(function () { nester.out() })

  t.equal(8, count, 'both pre and post increments should have happened')
  t.equal(0, outsider, 'original function has still been called')
})

test('wrap called with no arguments', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .twice()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.massWrap()
  }, "wrapping with no arguments doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with module but nothing else', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withExactArgs('must provide one or more functions to wrap on modules')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.massWrap(generator)
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
    shimmer.massWrap(generator, ['inc'])
  }, "wrapping with only original function doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with non-function original', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withExactArgs('must provide one or more functions to wrap on modules')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.massWrap({ orange: 'slices' }, 'orange', function () {})
  }, "wrapping non-function original doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('wrap called with non-function wrapper', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withArgs('must provide one or more functions to wrap on modules')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.massWrap({ orange: function () {} }, 'orange', 'hamchunx')
  }, "wrapping with non-function wrapper doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})
