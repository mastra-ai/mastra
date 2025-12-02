'use strict'

// Node v8 throw a `SyntaxError: Unexpected token import`
// even if this branch is never touched in the code,
// by using `eval` we can avoid this issue.
// eslint-disable-next-line
  new Function('module', 'return import(module)')('./esm.mjs').catch((err) => {
  process.nextTick(() => {
    throw err
  })
})

// Node v8 throw a `SyntaxError: Unexpected token import`
// even if this branch is never touched in the code,
// by using `eval` we can avoid this issue.
// eslint-disable-next-line
  new Function('module', 'return import(module)')('./named-exports.mjs').catch((err) => {
  process.nextTick(() => {
    throw err
  })
})
