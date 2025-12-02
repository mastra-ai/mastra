process.setMaxListeners(1000000);

const fs = require('fs')
const {test} = require('tap')
const requireInject = require('require-inject')

// defining mock for fs so its functions can be modified
const fsMock = Object.assign ( {}, fs, {
  /* ASYNC */
  mkdir (filename, opts, cb) {
    return cb(null);
  },
  realpath (filename, cb) {
    return cb(null, filename)
  },
  open (tmpfile, options, mode, cb) {
    if (/noopen/.test(tmpfile)) return cb(new Error('ENOOPEN'))
    cb(null, tmpfile)
  },
  write (fd) {
    const cb = arguments[arguments.length - 1]
    if (/nowrite/.test(fd)) return cb(new Error('ENOWRITE'))
    cb()
  },
  fsync (fd, cb) {
    if (/nofsync/.test(fd)) return cb(new Error('ENOFSYNC'))
    cb()
  },
  close (fd, cb) {
    cb()
  },
  chown (tmpfile, uid, gid, cb) {
    if (/nochown/.test(tmpfile)) return cb(new Error('ENOCHOWN'))
    cb()
  },
  chmod (tmpfile, mode, cb) {
    if (/nochmod/.test(tmpfile)) return cb(new Error('ENOCHMOD'))
    cb()
  },
  rename (tmpfile, filename, cb) {
    if (/norename/.test(tmpfile)) return cb(new Error('ENORENAME'))
    cb()
  },
  unlink (tmpfile, cb) {
    if (/nounlink/.test(tmpfile)) return cb(new Error('ENOUNLINK'))
    cb()
  },
  stat (tmpfile, cb) {
    if (/nostat/.test(tmpfile)) return cb(new Error('ENOSTAT'))
    cb()
  },
  /* SYNC */
  mkdirSync (filename) {},
  realpathSync (filename, cb) {
    return filename
  },
  openSync (tmpfile, options) {
    if (/noopen/.test(tmpfile)) throw new Error('ENOOPEN')
    return tmpfile
  },
  writeSync (fd) {
    if (/nowrite/.test(fd)) throw new Error('ENOWRITE')
  },
  fsyncSync (fd) {
    if (/nofsync/.test(fd)) throw new Error('ENOFSYNC')
  },
  closeSync () {},
  chownSync (tmpfile, uid, gid) {
    if (/nochown/.test(tmpfile)) throw new Error('ENOCHOWN')
  },
  chmodSync (tmpfile, mode) {
    if (/nochmod/.test(tmpfile)) throw new Error('ENOCHMOD')
  },
  renameSync (tmpfile, filename) {
    if (/norename/.test(tmpfile)) throw new Error('ENORENAME')
  },
  unlinkSync (tmpfile) {
    if (/nounlink/.test(tmpfile)) throw new Error('ENOUNLINK')
  },
  statSync (tmpfile) {
    if (/nostat/.test(tmpfile)) throw new Error('ENOSTAT')
  }
})

const {writeFile: writeFileAtomic} = requireInject('./atomically.cjs', { fs: fsMock });

// preserve original functions
const oldRealPath = fsMock.realpath
const oldRename = fsMock.rename

test('ensure writes to the same file are serial', t => {
  let fileInUse = false
  const ops = 5 // count for how many concurrent write ops to request
  t.plan(ops * 3 + 3)
  fsMock.realpath = (...args) => {
    t.notOk(fileInUse, 'file not in use')
    fileInUse = true
    oldRealPath(...args)
  }
  fsMock.rename = (...args) => {
    t.ok(fileInUse, 'file in use')
    fileInUse = false
    oldRename(...args)
  }
  const {writeFile: writeFileAtomic} = requireInject('./atomically.cjs', { fs: fsMock });
  for (let i = 0; i < ops; i++) {
    writeFileAtomic('test', 'test', err => {
      if (err) t.fail(err)
      else t.pass('wrote without error')
    })
  }
  setTimeout(() => {
    writeFileAtomic('test', 'test', err => {
      if (err) t.fail(err)
      else t.pass('successive writes after delay')
    })
  }, 500)
})

test('allow write to multiple files in parallel, but same file writes are serial', t => {
  const filesInUse = []
  const ops = 5
  let wasParallel = false
  fsMock.realpath = (filename, ...args) => {
    filesInUse.push(filename)
    const firstOccurence = filesInUse.indexOf(filename)
    t.equal(filesInUse.indexOf(filename, firstOccurence + 1), -1, 'serial writes') // check for another occurence after the first
    if (filesInUse.length > 1) wasParallel = true // remember that a parallel operation took place
    oldRealPath(filename, ...args)
  }
  fsMock.rename = (filename, ...args) => {
    filesInUse.splice(filesInUse.indexOf(filename), 1)
    oldRename(filename, ...args)
  }
  const {writeFile: writeFileAtomic} = requireInject('./atomically.cjs', { fs: fsMock });
  t.plan(ops * 2 * 2 + 1)
  let opCount = 0
  for (let i = 0; i < ops; i++) {
    writeFileAtomic('test', 'test', err => {
      if (err) t.fail(err, 'wrote without error')
      else t.pass('wrote without error')
    })
    writeFileAtomic('test2', 'test', err => {
      opCount++
      if (opCount === ops) t.ok(wasParallel, 'parallel writes')

      if (err) t.fail(err, 'wrote without error')
      else t.pass('wrote without error')
    })
  }
})
