'use strict'

var tap = require('tap')
var test = tap.test
var sinon = require('sinon')
var shimmer = require('../index.js')

var outsider = 0
function counter () { return ++outsider }

var generator = {
  inc: counter
}

test('should unwrap safely', function (t) {
  t.plan(9)

  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.doesNotThrow(function () { generator.inc() })
  t.equal(1, outsider, 'calls have side effects')

  function wrapper (original) {
    return function () {
      return original.apply(this, arguments)
    }
  }
  shimmer.wrap(generator, 'inc', wrapper)

  t.doesNotEqual(counter, generator.inc, 'function should be wrapped')

  t.doesNotThrow(function () { generator.inc() })
  t.equal(2, outsider, 'original function has still been called')

  shimmer.unwrap(generator, 'inc')
  t.equal(counter, generator.inc, 'basic function equality testing should work')
  t.doesNotThrow(function () { generator.inc() })
  t.equal(3, outsider, 'original function has still been called')
})

test("shouldn't throw on double unwrapping", function (t) {
  t.plan(6)

  t.equal(counter, generator.inc, 'basic function equality testing should work')

  var mock = sinon.expectation
    .create('logger')
    .withArgs('no original to unwrap to -- ' +
      'has inc already been unwrapped?')
    .once()
  shimmer({ logger: mock })

  function wrapper (original) {
    return function () {
      return original.apply(this, arguments)
    }
  }
  shimmer.wrap(generator, 'inc', wrapper)

  t.doesNotEqual(counter, generator.inc, 'function should be wrapped')

  shimmer.unwrap(generator, 'inc')
  t.equal(counter, generator.inc, 'basic function equality testing should work')

  t.doesNotThrow(function () { shimmer.unwrap(generator, 'inc') },
    'should double unwrap without issue')
  t.equal(counter, generator.inc, 'function is unchanged after unwrapping')

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('unwrap called with no arguments', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .twice()
  shimmer({ logger: mock })

  t.doesNotThrow(function () { shimmer.unwrap() }, 'should log instead of throwing')

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})

test('unwrap called with module but no name', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .twice()
  shimmer({ logger: mock })

  t.doesNotThrow(function () { shimmer.unwrap({}) }, 'should log instead of throwing')

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger was called with the expected message')
})
