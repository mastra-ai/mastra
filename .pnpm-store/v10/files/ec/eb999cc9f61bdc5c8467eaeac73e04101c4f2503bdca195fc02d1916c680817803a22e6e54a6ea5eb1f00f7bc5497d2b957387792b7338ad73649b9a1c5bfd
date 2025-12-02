'use strict'

const crypto = require('node:crypto')
const { join } = require('node:path')
const os = require('node:os')
const { existsSync, readFileSync, statSync, unlinkSync } = require('node:fs')
const writer = require('flush-write-stream')
const split = require('split2')

const pid = process.pid
const hostname = os.hostname()
const { tmpdir } = os

const isWin = process.platform === 'win32'
const isYarnPnp = process.versions.pnp !== undefined

function getPathToNull () {
  return isWin ? '\\\\.\\NUL' : '/dev/null'
}

function once (emitter, name) {
  return new Promise((resolve, reject) => {
    if (name !== 'error') emitter.once('error', reject)
    emitter.once(name, (...args) => {
      emitter.removeListener('error', reject)
      resolve(...args)
    })
  })
}

function sink (func) {
  const result = split((data) => {
    try {
      return JSON.parse(data)
    } catch (err) {
      console.log(err)
      console.log(data)
    }
  })
  if (func) result.pipe(writer.obj(func))
  return result
}

function check (is, chunk, level, msg) {
  is(new Date(chunk.time) <= new Date(), true, 'time is greater than Date.now()')
  delete chunk.time
  is(chunk.pid, pid)
  is(chunk.hostname, hostname)
  is(chunk.level, level)
  is(chunk.msg, msg)
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function watchFileCreated (filename) {
  return new Promise((resolve, reject) => {
    const TIMEOUT = process.env.PINO_TEST_WAIT_WATCHFILE_TIMEOUT || 10000
    const INTERVAL = 100
    const threshold = TIMEOUT / INTERVAL
    let counter = 0
    const interval = setInterval(() => {
      const exists = existsSync(filename)
      // On some CI runs file is created but not filled
      if (exists && statSync(filename).size !== 0) {
        clearInterval(interval)
        resolve()
      } else if (counter <= threshold) {
        counter++
      } else {
        clearInterval(interval)
        reject(new Error(
          `${filename} hasn't been created within ${TIMEOUT} ms. ` +
          (exists ? 'File exist, but still empty.' : 'File not yet created.')
        ))
      }
    }, INTERVAL)
  })
}

function watchForWrite (filename, testString) {
  return new Promise((resolve, reject) => {
    const TIMEOUT = process.env.PINO_TEST_WAIT_WRITE_TIMEOUT || 10000
    const INTERVAL = 100
    const threshold = TIMEOUT / INTERVAL
    let counter = 0
    const interval = setInterval(() => {
      if (readFileSync(filename).includes(testString)) {
        clearInterval(interval)
        resolve()
      } else if (counter <= threshold) {
        counter++
      } else {
        clearInterval(interval)
        reject(new Error(`'${testString}' hasn't been written to ${filename} within ${TIMEOUT} ms.`))
      }
    }, INTERVAL)
  })
}

let files = []

function file () {
  const hash = crypto.randomBytes(12).toString('hex')
  const file = join(tmpdir(), `pino-${pid}-${hash}`)
  files.push(file)
  return file
}

process.on('beforeExit', () => {
  if (files.length === 0) return
  for (const file of files) {
    try {
      unlinkSync(file)
    } catch (e) {
    }
  }
  files = []
})

/**
 * match is a bare-bones object shape matcher. We should be able to replace
 * this with `assert.partialDeepStrictEqual` when v22 is our minimum.
 *
 * @param {object} found
 * @param {object} expected
 */
function match (found, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (Object.prototype.toString.call(value) === '[object Object]') {
      match(found[key], value)
      continue
    }
    if (value !== found[key]) {
      throw Error(`expected "${value}" but found "${found[key]}"`)
    }
  }
}

module.exports = {
  check,
  file,
  getPathToNull,
  isWin,
  isYarnPnp,
  match,
  once,
  sink,
  sleep,
  watchFileCreated,
  watchForWrite
}
