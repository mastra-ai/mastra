process.setMaxListeners(1000000);

const fs = require('fs')
const os = require('os')
const path = require('path')
const {test} = require('tap')
const requireInject = require('require-inject')

let expectClose = 0
let closeCalled = 0
let expectCloseSync = 0
let closeSyncCalled = 0
const createErr = code => Object.assign(new Error(code), { code })

let unlinked = []

const fsMock = Object.assign ( {}, fs, {
  /* ASYNC */
  mkdir (filename, opts, cb) {
    return cb(null);
  },
  realpath (filename, cb) {
    return cb(null, filename)
  },
  open (tmpfile, options, mode, cb) {
    if (/noopen/.test(tmpfile)) return cb(createErr('ENOOPEN'))
    expectClose++
    cb(null, tmpfile)
  },
  write (fd) {
    const cb = arguments[arguments.length - 1]
    if (/nowrite/.test(fd)) return cb(createErr('ENOWRITE'))
    cb()
  },
  fsync (fd, cb) {
    if (/nofsync/.test(fd)) return cb(createErr('ENOFSYNC'))
    cb()
  },
  close (fd, cb) {
    closeCalled++
    cb()
  },
  chown (tmpfile, uid, gid, cb) {
    if (/nochown/.test(tmpfile)) return cb(createErr('ENOCHOWN'))
    if (/enosys/.test(tmpfile)) return cb(createErr('ENOSYS'))
    if (/einval/.test(tmpfile)) return cb(createErr('EINVAL'))
    if (/eperm/.test(tmpfile)) return cb(createErr('EPERM'))
    cb()
  },
  chmod (tmpfile, mode, cb) {
    if (/nochmod/.test(tmpfile)) return cb(createErr('ENOCHMOD'))
    if (/enosys/.test(tmpfile)) return cb(createErr('ENOSYS'))
    if (/eperm/.test(tmpfile)) return cb(createErr('EPERM'))
    if (/einval/.test(tmpfile)) return cb(createErr('EINVAL'))
    cb()
  },
  rename (tmpfile, filename, cb) {
    if (/norename/.test(tmpfile)) return cb(createErr('ENORENAME'))
    cb()
  },
  unlink (tmpfile, cb) {
    if (/nounlink/.test(tmpfile)) return cb(createErr('ENOUNLINK'))
    cb()
  },
  stat (tmpfile, cb) {
    if (/nostat/.test(tmpfile)) return cb(createErr('ENOSTAT'))
    if (/statful/.test(tmpfile)) return cb(null, fs.statSync('/'));
    cb()
  },
  /* SYNC */
  mkdirSync (filename) {},
  realpathSync (filename, cb) {
    return filename
  },
  openSync (tmpfile, options) {
    if (/noopen/.test(tmpfile)) throw createErr('ENOOPEN')
    expectCloseSync++
    return tmpfile
  },
  writeSync (fd) {
    if (/nowrite/.test(fd)) throw createErr('ENOWRITE')
  },
  fsyncSync (fd) {
    if (/nofsync/.test(fd)) throw createErr('ENOFSYNC')
  },
  closeSync (fd) {
    closeSyncCalled++
  },
  chownSync (tmpfile, uid, gid) {
    if (/nochown/.test(tmpfile)) throw createErr('ENOCHOWN')
    if (/enosys/.test(tmpfile)) throw createErr('ENOSYS')
    if (/einval/.test(tmpfile)) throw createErr('EINVAL')
    if (/eperm/.test(tmpfile)) throw createErr('EPERM')
  },
  chmodSync (tmpfile, mode) {
    if (/nochmod/.test(tmpfile)) throw createErr('ENOCHMOD')
    if (/enosys/.test(tmpfile)) throw createErr('ENOSYS')
    if (/einval/.test(tmpfile)) throw createErr('EINVAL')
    if (/eperm/.test(tmpfile)) throw createErr('EPERM')
  },
  renameSync (tmpfile, filename) {
    if (/norename/.test(tmpfile)) throw createErr('ENORENAME')
  },
  unlinkSync (tmpfile) {
    if (/nounlink/.test(tmpfile)) throw createErr('ENOUNLINK')
    unlinked.push(tmpfile)
  },
  statSync (tmpfile) {
    if (/nostat/.test(tmpfile)) throw createErr('ENOSTAT')
    if (/statful/.test(tmpfile)) return fs.statSync('/');
  }
});

const makeUnstableAsyncFn = function () {
  return function () {
    if ( Math.random () <= .75 ) {
      const code = ['EMFILE', 'ENFILE', 'EAGAIN', 'EBUSY', 'EACCESS', 'EPERM'].sort ( () => Math.random () - .5 )[0];
      throw createErr ( code );
    }
    return arguments[arguments.length -1](null, arguments[0]);
  };
};

const makeUnstableSyncFn = function ( fn ) {
  return function () {
    if ( Math.random () <= .75 ) {
      const code = ['EMFILE', 'ENFILE', 'EAGAIN', 'EBUSY', 'EACCESS', 'EPERM'].sort ( () => Math.random () - .5 )[0];
      throw createErr ( code );
    }
    return fn.apply(undefined, arguments)
  };
};

const fsMockUnstable = Object.assign ( {}, fsMock, {
  open: makeUnstableAsyncFn (),
  write: makeUnstableAsyncFn (),
  fsync: makeUnstableAsyncFn (),
  close: makeUnstableAsyncFn (),
  rename: makeUnstableAsyncFn (),
  openSync: makeUnstableSyncFn ( x => x ),
  writeSync: makeUnstableSyncFn ( () => {} ),
  fsyncSync: makeUnstableSyncFn ( () => {} ),
  closeSync: makeUnstableSyncFn ( () => {} ),
  renameSync: makeUnstableSyncFn ( () => {} )
});

const {writeFile: writeFileAtomic, writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs: fsMock });

test('async tests', t => {
  t.plan(2)

  expectClose = 0
  closeCalled = 0
  t.teardown(() => {
    t.parent.equal(closeCalled, expectClose, 'async tests closed all files')
    expectClose = 0
    closeCalled = 0
  })

  t.test('non-root tests', t => {
    t.plan(28)

    writeFileAtomic('good', 'test', { mode: '0777' }, err => {
      t.notOk(err, 'No errors occur when passing in options')
    })
    writeFileAtomic('good', 'test', 'utf8', err => {
      t.notOk(err, 'No errors occur when passing in options as string')
    })
    writeFileAtomic('good', 'test', undefined, err => {
      t.notOk(err, 'No errors occur when NOT passing in options')
    })
    writeFileAtomic('good', 'test', err => {
      t.notOk(err)
    })
    writeFileAtomic('noopen', 'test', err => {
      t.equal(err.message, 'ENOOPEN', 'fs.open failures propagate')
    })
    writeFileAtomic('nowrite', 'test', err => {
      t.equal(err.message, 'ENOWRITE', 'fs.writewrite failures propagate')
    })
    writeFileAtomic('nowrite', Buffer.from('test', 'utf8'), err => {
      t.equal(err.message, 'ENOWRITE', 'fs.writewrite failures propagate for buffers')
    })
    writeFileAtomic('nochown', 'test', { chown: { uid: 100, gid: 100 } }, err => {
      t.equal(err.message, 'ENOCHOWN', 'Chown failures propagate')
    })
    writeFileAtomic('nochown', 'test', err => {
      t.notOk(err, 'No attempt to chown when no uid/gid passed in')
    })
    writeFileAtomic('nochmod', 'test', { mode: parseInt('741', 8) }, err => {
      t.equal(err.message, 'ENOCHMOD', 'Chmod failures propagate')
    })
    writeFileAtomic('nofsyncopt', 'test', { fsync: false }, err => {
      t.notOk(err, 'fsync skipped if options.fsync is false')
    })
    writeFileAtomic('norename', 'test', err => {
      t.equal(err.message, 'ENORENAME', 'Rename errors propagate')
    })
    writeFileAtomic('norename nounlink', 'test', err => {
      t.equal(err.message, 'ENORENAME', 'Failure to unlink the temp file does not clobber the original error')
    })
    writeFileAtomic('nofsync', 'test', err => {
      t.equal(err.message, 'ENOFSYNC', 'Fsync failures propagate')
    })
    writeFileAtomic('enosys', 'test', err => {
      t.notOk(err, 'No errors on ENOSYS')
    })
    writeFileAtomic('einval', 'test', { mode: 0o741 }, err => {
      t.notOk(err, 'No errors on EINVAL for non root')
    })
    writeFileAtomic('eperm', 'test', { mode: 0o741 }, err => {
      t.notOk(err, 'No errors on EPERM for non root')
    })
    writeFileAtomic('einval', 'test', { chown: { uid: 100, gid: 100 } }, err => {
      t.notOk(err, 'No errors on EINVAL for non root')
    })
    writeFileAtomic('eperm', 'test', { chown: { uid: 100, gid: 100 } }, err => {
      t.notOk(err, 'No errors on EPERM for non root')
    })
    const optionsImmutable = {};
    writeFileAtomic('statful', 'test', optionsImmutable, err => {
      t.notOk(err);
      t.same(optionsImmutable, {});
    });
    const schedule = filePath => {
      t.equal(filePath, 'good');
      return new Promise ( resolve => {
        resolve ( () => {
          t.equal(true,true);
        });
      });
    };
    writeFileAtomic('good','test', {schedule}, err => {
      t.notOk(err);
    });
    const tmpCreate = filePath => `.${filePath}.custom`;
    const tmpCreated = filePath => t.equal(filePath, '.good.custom' );
    writeFileAtomic('good','test', {tmpCreate, tmpCreated}, err => {
      t.notOk(err)
    })
    const longPath = path.join(os.tmpdir(),'.012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789.txt');
    const {writeFile: writeFileAtomicNative} = requireInject('./atomically.cjs', { fs });
    writeFileAtomicNative(longPath,'test', err => {
      t.notOk(err)
    })
    const pathMissingFolders = path.join(os.tmpdir(),String(Math.random()),String(Math.random()),String(Math.random()),'foo.txt');
    writeFileAtomicNative(pathMissingFolders,'test', err => {
      t.notOk(err)
    })
  })

  t.test('errors for root', t => {
    const { getuid } = process
    process.getuid = () => 0
    t.teardown(() => {
      process.getuid = getuid
    })
    const {writeFile: writeFileAtomic} = requireInject('./atomically.cjs', { fs: fsMock });
    t.plan(2)
    writeFileAtomic('einval', 'test', { chown: { uid: 100, gid: 100 } }, err => {
      t.match(err, { code: 'EINVAL' })
    })
    writeFileAtomic('einval', 'test', { mode: 0o741 }, err => {
      t.match(err, { code: 'EINVAL' })
    })
  })
})

test('unstable async tests', t => {
  t.plan(2);
  const {writeFile: writeFileAtomic} = requireInject('./atomically.cjs', { fs: fsMockUnstable });
  writeFileAtomic('good', 'test', err => {
    t.notOk(err, 'No errors occur when retryable errors are thrown')
  })
  writeFileAtomic('good', 'test', { timeout: 0 }, err => {
    t.equal(!!err.code, true, 'Retrying can be disabled')
  })
});

test('sync tests', t => {
  t.plan(2)
  closeSyncCalled = 0
  expectCloseSync = 0
  t.teardown(() => {
    t.parent.equal(closeSyncCalled, expectCloseSync, 'sync closed all files')
    expectCloseSync = 0
    closeSyncCalled = 0
  })

  const throws = function (t, shouldthrow, msg, todo) {
    let err
    try { todo() } catch (e) { err = e }
    t.equal(shouldthrow, err.message, msg)
  }
  const noexception = function (t, msg, todo) {
    let err
    try { todo() } catch (e) { err = e }
    t.error(err, msg)
  }
  let tmpfile

  t.test('non-root', t => {
    t.plan(38)
    noexception(t, 'No errors occur when passing in options', () => {
      writeFileAtomicSync('good', 'test', { mode: '0777' })
    })
    noexception(t, 'No errors occur when passing in options as string', () => {
      writeFileAtomicSync('good', 'test', 'utf8')
    })
    noexception(t, 'No errors occur when NOT passing in options', () => {
      writeFileAtomicSync('good', 'test')
    })
    noexception(t, 'fsync never called if options.fsync is falsy', () => {
      writeFileAtomicSync('good', 'test', { fsync: false })
    })
    noexception(t, 'tmpCreated is called on success', () => {
      writeFileAtomicSync('good', 'test', {
        tmpCreated (gottmpfile) {
          tmpfile = gottmpfile
        }
      })
      t.match(tmpfile, /^good\.tmp-\w+$/, 'tmpCreated called for success')
      t.match(tmpfile, /^good\.tmp-\d{10}[a-f0-9]{6}$/, 'tmpCreated format')
    })

    tmpfile = undefined
    throws(t, 'ENOOPEN', 'fs.openSync failures propagate', () => {
      writeFileAtomicSync('noopen', 'test', {
        tmpCreated (gottmpfile) {
          tmpfile = gottmpfile
        }
      })
    })
    t.equal(tmpfile, undefined, 'tmpCreated not called for open failure')

    throws(t, 'ENOWRITE', 'fs.writeSync failures propagate', () => {
      writeFileAtomicSync('nowrite', 'test', {
        tmpCreated (gottmpfile) {
          tmpfile = gottmpfile
        }
      })
    })
    t.match(tmpfile, /^nowrite\.tmp-\w+$/, 'tmpCreated called for failure after open')

    throws(t, 'ENOCHOWN', 'Chown failures propagate', () => {
      writeFileAtomicSync('nochown', 'test', { chown: { uid: 100, gid: 100 } })
    })
    noexception(t, 'No attempt to chown when false passed in', () => {
      writeFileAtomicSync('nochown', 'test', { chown: false })
    })
    noexception(t, 'No errors occured when chown is undefined and original file owner used', () => {
      writeFileAtomicSync('chowncopy', 'test', { chown: undefined })
    })
    throws(t, 'ENORENAME', 'Rename errors propagate', () => {
      writeFileAtomicSync('norename', 'test')
    })
    throws(t, 'ENORENAME', 'Failure to unlink the temp file does not clobber the original error', () => {
      writeFileAtomicSync('norename nounlink', 'test')
    })
    throws(t, 'ENOFSYNC', 'Fsync errors propagate', () => {
      writeFileAtomicSync('nofsync', 'test')
    })
    noexception(t, 'No errors on ENOSYS', () => {
      writeFileAtomicSync('enosys', 'test', { chown: { uid: 100, gid: 100 } })
    })
    noexception(t, 'No errors on EINVAL for non root', () => {
      writeFileAtomicSync('einval', 'test', { chown: { uid: 100, gid: 100 } })
    })
    noexception(t, 'No errors on EPERM for non root', () => {
      writeFileAtomicSync('eperm', 'test', { chown: { uid: 100, gid: 100 } })
    })

    throws(t, 'ENOCHMOD', 'Chmod failures propagate', () => {
      writeFileAtomicSync('nochmod', 'test', { mode: 0o741 })
    })
    noexception(t, 'No errors on EPERM for non root', () => {
      writeFileAtomicSync('eperm', 'test', { mode: 0o741 })
    })
    noexception(t, 'No attempt to chmod when no mode provided', () => {
      writeFileAtomicSync('nochmod', 'test', { mode: false })
    })
    const optionsImmutable = {};
    noexception(t, 'options are immutable', () => {
      writeFileAtomicSync('statful', 'test', optionsImmutable)
    })
    t.same(optionsImmutable, {});
    const tmpCreate = filePath => `.${filePath}.custom`;
    const tmpCreated = filePath => t.equal(filePath, '.good.custom' );
    noexception(t, 'custom temp creator', () => {
      writeFileAtomicSync('good', 'test', {tmpCreate, tmpCreated})
    })
    const path0 = path.join(os.tmpdir(),'atomically-test-0');
    const tmpPath0 = path0 + '.temp';
    noexception(t, 'temp files are purged on success', () => {
      const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs });
      writeFileAtomicSync(path0, 'test', {tmpCreate: () => tmpPath0})
    })
    t.equal(true,fs.existsSync(path0));
    t.equal(false,fs.existsSync(tmpPath0));
    const path1 = path.join(os.tmpdir(),'atomically-test-norename-1');
    const tmpPath1 = path1 + '.temp';
    throws(t, 'ENORENAME', 'temp files are purged on error', () => {
      const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs: Object.assign ( {}, fs, { renameSync: fsMock.renameSync })});
      writeFileAtomicSync(path1, 'test', {tmpCreate: () => tmpPath1})
    })
    t.equal(false,fs.existsSync(path1));
    t.equal(false,fs.existsSync(tmpPath1));
    const path2 = path.join(os.tmpdir(),'atomically-test-norename-2');
    const tmpPath2 = path2 + '.temp';
    throws(t, 'ENORENAME', 'temp files can also not be purged on error', () => {
      const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs: Object.assign ( {}, fs, { renameSync: fsMock.renameSync })});
      writeFileAtomicSync(path2, 'test', {tmpCreate: () => tmpPath2,tmpPurge: false})
    })
    t.equal(false,fs.existsSync(path2));
    t.equal(true,fs.existsSync(tmpPath2));
    const longPath = path.join(os.tmpdir(),'.012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789.txt');
    noexception(t, 'temp files are truncated', () => {
      const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs });
      writeFileAtomicSync(longPath, 'test')
    })
    const pathMissingFolders = path.join(os.tmpdir(),String(Math.random()),String(Math.random()),String(Math.random()),'foo.txt');
    noexception(t, 'parent folders are created', () => {
      const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs });
      writeFileAtomicSync(pathMissingFolders, 'test')
    })
  })

  t.test('errors for root', t => {
    const { getuid } = process
    process.getuid = () => 0
    t.teardown(() => {
      process.getuid = getuid
    })
    const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs: fsMock });
    t.plan(2)
    throws(t, 'EINVAL', 'Chown error as root user', () => {
      writeFileAtomicSync('einval', 'test', { chown: { uid: 100, gid: 100 } })
    })
    throws(t, 'EINVAL', 'Chmod error as root user', () => {
      writeFileAtomicSync('einval', 'test', { mode: 0o741 })
    })
  })
})

test('unstable sync tests', t => {
  t.plan(2);

  const throws = function (t, msg, todo) {
    let err
    try { todo() } catch (e) { err = e }
    t.equal(!!err.code, true, msg)
  }

  const noexception = function (t, msg, todo) {
    let err
    try { todo() } catch (e) { err = e }
    t.error(err, msg)
  }

  noexception(t, 'No errors occur when retryable errors are thrown', () => {
    const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs: fsMockUnstable });
    writeFileAtomicSync('good', 'test')
  })

  throws(t, 'retrying can be disabled', () => {
    const {writeFileSync: writeFileAtomicSync} = requireInject('./atomically.cjs', { fs: fsMockUnstable });
    writeFileAtomicSync('good', 'test', { timeout: 0 })
  })
});

test('promises', async t => {
  let tmpfile
  closeCalled = 0
  expectClose = 0
  t.teardown(() => {
    t.parent.equal(closeCalled, expectClose, 'promises closed all files')
    closeCalled = 0
    expectClose = 0
  })

  await writeFileAtomic('good', 'test', {
    tmpCreated (gottmpfile) {
      tmpfile = gottmpfile
    }
  })
  t.match(tmpfile, /^good\.tmp-\w+$/, 'tmpCreated is called for success')

  await writeFileAtomic('good', 'test', {
    tmpCreated (gottmpfile) {
      return Promise.resolve()
    }
  })

  tmpfile = undefined
  await t.rejects(writeFileAtomic('noopen', 'test', {
    tmpCreated (gottmpfile) {
      tmpfile = gottmpfile
    }
  }))
  t.equal(tmpfile, undefined, 'tmpCreated is not called on open failure')

  await t.rejects(writeFileAtomic('nowrite', 'test', {
    tmpCreated (gottmpfile) {
      tmpfile = gottmpfile
    }
  }))
  t.match(tmpfile, /^nowrite\.tmp-\w+$/, 'tmpCreated is called if failure is after open')
})
