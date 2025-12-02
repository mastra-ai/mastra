
/* IMPORT */

import process from 'node:process';

/* MAIN */

const IS_USER_ROOT = process.getuid ? !process.getuid () : false;

const LIMIT_FILES_DESCRIPTORS = 10_000; //TODO: Fetch the real limit from the filesystem, somehow

const NOOP = () => undefined;

/* EXPORT */

export {IS_USER_ROOT, LIMIT_FILES_DESCRIPTORS, NOOP};
