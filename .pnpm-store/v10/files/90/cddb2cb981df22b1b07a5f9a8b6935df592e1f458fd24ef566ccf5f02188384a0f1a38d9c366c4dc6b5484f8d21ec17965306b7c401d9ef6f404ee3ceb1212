
/* IMPORT */

import fs from 'node:fs';
import {promisify} from 'node:util';
import {attemptifyAsync, attemptifySync} from './attemptify';
import {NOOP} from './constants';
import Handlers from './handlers';
import {retryifyAsync, retryifySync} from './retryify';

/* MAIN */

const FS = {
  attempt: {
    /* ASYNC */
    chmod: attemptifyAsync ( promisify ( fs.chmod ), Handlers.onChangeError ),
    chown: attemptifyAsync ( promisify ( fs.chown ), Handlers.onChangeError ),
    close: attemptifyAsync ( promisify ( fs.close ), NOOP ),
    fsync: attemptifyAsync ( promisify ( fs.fsync ), NOOP ),
    mkdir: attemptifyAsync ( promisify ( fs.mkdir ), NOOP ),
    realpath: attemptifyAsync ( promisify ( fs.realpath ), NOOP ),
    stat: attemptifyAsync ( promisify ( fs.stat ), NOOP ),
    unlink: attemptifyAsync ( promisify ( fs.unlink ), NOOP ),
    /* SYNC */
    chmodSync: attemptifySync ( fs.chmodSync, Handlers.onChangeError ),
    chownSync: attemptifySync ( fs.chownSync, Handlers.onChangeError ),
    closeSync: attemptifySync ( fs.closeSync, NOOP ),
    existsSync: attemptifySync ( fs.existsSync, NOOP ),
    fsyncSync: attemptifySync ( fs.fsync, NOOP ),
    mkdirSync: attemptifySync ( fs.mkdirSync, NOOP ),
    realpathSync: attemptifySync ( fs.realpathSync, NOOP ),
    statSync: attemptifySync ( fs.statSync, NOOP ),
    unlinkSync: attemptifySync ( fs.unlinkSync, NOOP )
  },
  retry: {
    /* ASYNC */
    close: retryifyAsync ( promisify ( fs.close ), Handlers.isRetriableError ),
    fsync: retryifyAsync ( promisify ( fs.fsync ), Handlers.isRetriableError ),
    open: retryifyAsync ( promisify ( fs.open ), Handlers.isRetriableError ),
    readFile: retryifyAsync ( promisify ( fs.readFile ), Handlers.isRetriableError ),
    rename: retryifyAsync ( promisify ( fs.rename ), Handlers.isRetriableError ),
    stat: retryifyAsync ( promisify ( fs.stat ), Handlers.isRetriableError ),
    write: retryifyAsync ( promisify ( fs.write ), Handlers.isRetriableError ),
    writeFile: retryifyAsync ( promisify ( fs.writeFile ), Handlers.isRetriableError ),
    /* SYNC */
    closeSync: retryifySync ( fs.closeSync, Handlers.isRetriableError ),
    fsyncSync: retryifySync ( fs.fsyncSync, Handlers.isRetriableError ),
    openSync: retryifySync ( fs.openSync, Handlers.isRetriableError ),
    readFileSync: retryifySync ( fs.readFileSync, Handlers.isRetriableError ),
    renameSync: retryifySync ( fs.renameSync, Handlers.isRetriableError ),
    statSync: retryifySync ( fs.statSync, Handlers.isRetriableError ),
    writeSync: retryifySync ( fs.writeSync, Handlers.isRetriableError ),
    writeFileSync: retryifySync ( fs.writeFileSync, Handlers.isRetriableError )
  }
};

/* EXPORT */

export default FS;
