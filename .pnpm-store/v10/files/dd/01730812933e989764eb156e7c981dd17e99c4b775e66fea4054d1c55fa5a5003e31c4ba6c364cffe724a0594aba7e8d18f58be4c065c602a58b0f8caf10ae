'use strict'

var tap = require('tap')
var test = tap.test
var sinon = require('sinon')
var shimmer = require('../index.js')

test('shimmer initialization', function (t) {
  t.plan(4)

  t.doesNotThrow(function () { shimmer() })

  var mock = sinon.expectation
    .create('logger')
    .withArgs('no original function undefined to wrap')
    .once()

  t.doesNotThrow(function () {
    shimmer({ logger: mock })
  }, "initializer doesn't throw")

  t.doesNotThrow(function () {
    shimmer.wrap()
  }, "invoking the wrap method with no params doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger method was called with the expected message')
})

test('shimmer initialized with non-function logger', function (t) {
  t.plan(2)

  var mock = sinon.expectation
    .create('logger')
    .withArgs("new logger isn't a function, not replacing")
    .once()

  shimmer({ logger: mock })

  t.doesNotThrow(function () {
    shimmer({ logger: { ham: 'chunx' } })
  }, "even bad initialization doesn't throw")

  t.doesNotThrow(function () {
    mock.verify()
  }, 'logger initialization failed in the expected way')
})
