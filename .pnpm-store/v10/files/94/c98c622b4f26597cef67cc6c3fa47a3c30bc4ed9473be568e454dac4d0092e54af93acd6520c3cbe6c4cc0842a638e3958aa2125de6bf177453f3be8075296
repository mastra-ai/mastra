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

test('should unwrap safely', function (t) {
  t.plan(18)

  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.equal(anticounter, generator.dec, 'basic function equality testing should work')
  t.doesNotThrow(function () { generator.inc() })
  t.equal(1, outsider, 'calls have side effects')
  t.doesNotThrow(function () { generator.dec() })
  t.equal(0, outsider, 'calls have side effects')

  function wrapper (original) {
    return function () {
      return original.apply(this, arguments)
    }
  }
  shimmer.massWrap(generator, ['inc', 'dec'], wrapper)

  t.doesNotEqual(counter, generator.inc, 'function should be wrapped')
  t.doesNotEqual(anticounter, generator.dec, 'function should be wrapped')

  t.doesNotThrow(function () { generator.inc() })
  t.equal(1, outsider, 'original function has still been called')
  t.doesNotThrow(function () { generator.dec() })
  t.equal(0, outsider, 'original function has still been called')

  shimmer.massUnwrap(generator, ['inc', 'dec'])
  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.equal(anticounter, generator.dec, 'basic function equality testing should work')

  t.doesNotThrow(function () { generator.inc() })
  t.equal(1, outsider, 'original function has still been called')
  t.doesNotThrow(function () { generator.dec() })
  t.equal(0, outsider, 'original function has still been called')
})

test("shouldn't throw on double unwrapping", function (t) {
  t.plan(10)

  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.equal(anticounter, generator.dec, 'basic function equality testing should work')

  var mock = sinon.stub()
  shimmer({ logger: mock })

  function wrapper (original) {
    return function () {
      return original.apply(this, arguments)
    }
  }
  shimmer.wrap(generator, 'inc', wrapper)
  shimmer.wrap(generator, 'dec', wrapper)

  t.doesNotEqual(counter, generator.inc, 'function should be wrapped')
  t.doesNotEqual(anticounter, generator.dec, 'function should be wrapped')

  shimmer.massUnwrap(generator, ['inc', 'dec'])
  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.equal(anticounter, generator.dec, 'basic function equality testing should work')

  t.doesNotThrow(function () { shimmer.massUnwrap(generator, ['inc', 'dec']) },
    'should double unwrap without issue')
  t.equal(counter, generator.inc, 'function is unchanged after unwrapping')
  t.equal(anticounter, generator.dec, 'function is unchanged after unwrapping')

  t.doesNotThrow(function () {
    sinon.assert.calledWith(mock, 'no original to unwrap to -- ' +
      'has inc already been unwrapped?')
    sinon.assert.calledWith(mock, 'no original to unwrap to -- ' +
      'has dec already been unwrapped?')
    sinon.assert.calledTwice(mock)
  }, 'logger was called with the expected message')
})

test('massUnwrap called with no arguments', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .twice()
  shimmer({ logger: mock })

  t.doesNotThrow(function () { shimmer.massUnwrap() }, 'should log instead of throwing')

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('massUnwrap called with module but nothing else', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withExactArgs('must provide one or more functions to unwrap on modules')
    .once()
  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer.massUnwrap(generator)
  }, "wrapping with only 1 argument doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})
