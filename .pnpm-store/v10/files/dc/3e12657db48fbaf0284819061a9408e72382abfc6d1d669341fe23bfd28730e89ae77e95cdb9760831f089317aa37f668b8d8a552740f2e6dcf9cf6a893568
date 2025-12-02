
/* IMPORT */

import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import writeFileAtomic from 'write-file-atomic';
import {writeFile, writeFileSync} from '../dist/index.js';

/* MAIN */

const TEMP = os.tmpdir ();
const UUID = randomUUID ();
const DST = i => path.join ( TEMP, `atomically-${UUID}-temp-${i}.txt` );
const ITERATIONS = 250;

const runSingleAsync = async ( name, fn, buffer, options ) => {
  console.time ( name );
  for ( let i = 0; i < ITERATIONS; i++ ) {
    await fn ( DST ( i ), buffer, options );
  }
  console.timeEnd ( name );
  await delay ( 1000 );
};

const runSingleSync = async ( name, fn, buffer, options ) => {
  console.time ( name );
  for ( let i = 0; i < ITERATIONS; i++ ) {
    fn ( DST ( i ), buffer, options );
  }
  console.timeEnd ( name );
  await delay ( 1000 );
};

const runAllDummy = () => { // Preparation run
  runSingleSync ( 'dummy', fs.writeFileSync, '' );
};

const runAllAsync = async ( name, buffer ) => {
  await runSingleAsync ( `${name} -> async -> write-file-atomic`, writeFileAtomic, buffer, { mode: 0o666 } );
  await runSingleAsync ( `${name} -> async -> write-file-atomic (faster)`, writeFileAtomic, buffer );
  await runSingleAsync ( `${name} -> async -> write-file-atomic (fastest)`, writeFileAtomic, buffer, { fsync: false } );
  await runSingleAsync ( `${name} -> async -> atomically`, writeFile, buffer );
  await runSingleAsync ( `${name} -> async -> atomically (faster)`, writeFile, buffer, { mode: false, chown: false, fsyncWait: false } );
  await runSingleAsync ( `${name} -> async -> atomically (fastest)`, writeFile, buffer, { mode: false, chown: false, fsync: false } );
};

const runAllSync = ( name, buffer ) => {
  runSingleSync ( `${name} -> sync -> write-file-atomic`, writeFileAtomic.sync, buffer, { mode: 0o666 } );
  runSingleSync ( `${name} -> sync -> write-file-atomic (faster)`, writeFileAtomic.sync, buffer );
  runSingleSync ( `${name} -> sync -> write-file-atomic (fastest)`, writeFileAtomic.sync, buffer, { fsync: false } );
  runSingleSync ( `${name} -> sync -> atomically`, writeFileSync, buffer );
  runSingleSync ( `${name} -> sync -> atomically (faster)`, writeFileSync, buffer, { mode: false, chown: false, fsyncWait: false } );
  runSingleSync ( `${name} -> sync -> atomically (fastest)`, writeFileSync, buffer, { mode: false, chown: false, fsync: false } );
};

const runAll = async ( name, buffer ) => {
  await runAllAsync ( name, buffer );
  console.log ( '-------------------' );
  runAllSync ( name, buffer );
};

const run = async () => {
  runAllDummy ();
  console.log ( '===================' );
  await runAll ( '100kb', Buffer.allocUnsafe ( 100 * 1024 ) );
  console.log ( '===================' );
  await runAll ( '10kb', Buffer.allocUnsafe ( 10 * 1024 ) );
  console.log ( '===================' );
  await runAll ( '1kb', Buffer.allocUnsafe ( 1024 ) );
  console.log ( '===================' );
};

run ();
