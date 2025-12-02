'use strict'
const assert = require('assert')
const tsame = require('tsame')
const { it } = require('mocha')
const bytes = require('../')

const test = it

const same = (x, y) => assert.ok(tsame(x, y))

test('string conversion', done => {
  const ab = bytes('hello world')
  assert(ab instanceof DataView)
  const str = bytes.toString(ab)
  same(str, 'hello world')
  done()
})

test('compare', done => {
  const a = bytes('hello world')
  const b = bytes('hello world 2')
  assert(bytes.compare(a, a))
  assert(bytes.compare(a, 'hello world'))
  assert(!bytes.compare(a, b))
  assert(!bytes.compare(b, a))
  assert(!bytes.compare(a, '123'))
  assert(!bytes.compare('123', a))
  done()
})

test('double view', done => {
  const a = bytes('hello world')
  const b = bytes(a)
  same(a, b)
  done()
})

test('typed array', done => {
  const ab = bytes.random(4)
  const view = bytes(ab)
  const uint = bytes.typedArray(ab, Uint32Array)
  assert(uint instanceof Uint32Array)
  assert(bytes.compare(uint, view))
  done()
})

test('from array buffer', done => {
  const a = bytes('hello world')
  const b = bytes(bytes.memcopy(a))
  same(bytes.toString(a), bytes.toString(b))
  done()
})

test('to array buffer', done => {
  const a = bytes.arrayBuffer('hello world')
  const b = bytes('hello world')
  assert(a instanceof ArrayBuffer)
  assert(bytes.compare(a, b))
  assert(a, bytes.arrayBuffer(a))
  done()
})

test('Uint8Array', done => {
  const a = bytes('hello world')
  const b = bytes(new Uint8Array(bytes.memcopy(a)))
  same(bytes.toString(a), bytes.toString(b))
  done()
})

test('native', done => {
  let n = bytes.native('hello world')
  if (process.browser) {
    assert(n instanceof Uint8Array)
    n = bytes.native(n)
    assert(n instanceof Uint8Array)
  } else {
    assert(n instanceof Buffer)
    n = bytes.native(n)
    assert(n instanceof Buffer)
  }
  done()
})

test('slice', done => {
  const a = bytes.slice('hello world', 2, 7)
  assert(a instanceof DataView)
  const b = bytes.arrayBuffer('hello world').slice(2, 7)
  same(b, bytes.arrayBuffer(a))
  done()
})

test('slice memcopy', done => {
  const a = bytes.memcopySlice('hello world', 2, 7)
  assert(a instanceof ArrayBuffer)
  const b = bytes.arrayBuffer('hello world').slice(2, 7)
  same(b, a)
  const c = bytes.memcopySlice(a)
  assert(a !== c)
  same(a, c)
  done()
})

test('concat', done => {
  let values = [bytes('1'), bytes.native('2'), bytes.arrayBuffer('3')]
  let ab = bytes.concat(values)
  assert(ab instanceof ArrayBuffer)
  assert(bytes.compare(ab, '123'))
  values = [bytes('one')]
  ab = bytes.concat(values)
  assert(bytes.compare(ab, 'one'))
  done()
})

test('random above max entropy', done => {
  const maxEntropy = 65536
  const size = (maxEntropy * 3) + 8
  const rand = bytes.random(size)
  same(rand.byteLength, size)
  done()
})
