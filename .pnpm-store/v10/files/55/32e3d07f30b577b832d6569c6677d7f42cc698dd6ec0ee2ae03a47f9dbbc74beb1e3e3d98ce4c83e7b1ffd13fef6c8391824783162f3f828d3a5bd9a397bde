'use strict'
const betterPathResolve = require('better-path-resolve')
const path = require('path')

function isSubdir (parentDir, subdir) {
  const rParent = `${betterPathResolve(parentDir)}${path.sep}`
  const rDir = `${betterPathResolve(subdir)}${path.sep}`
  return rDir.startsWith(rParent)
}

isSubdir.strict = function isSubdirStrict (parentDir, subdir) {
  const rParent = `${betterPathResolve(parentDir)}${path.sep}`
  const rDir = `${betterPathResolve(subdir)}${path.sep}`
  return rDir !== rParent && rDir.startsWith(rParent)
}

module.exports = isSubdir
