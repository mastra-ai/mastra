import { fork, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

if (typeof require === 'undefined') {
  global.require = createRequire(import.meta.url);
}

/**
 *
 * @param {*} args
 * @param {*} childOptions
 * @returns {Promise<import('child_process').ChildProcess>}
 */
export function runRegistry(args = [], childOptions) {
  return new Promise((resolve, reject) => {
    const childFork = fork(require.resolve('verdaccio/bin/verdaccio'), args, {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      ...childOptions,
    });
    childFork.on('message', msg => {
      if (msg.verdaccio_started) {
        resolve(childFork);
      }
    });

    childFork.on('error', err => reject([err]));
    childFork.on('disconnect', err => reject([err]));
  });
}

export function login(user, password, port) {
  execSync(`npx npm-cli-login -u ${user} -p ${password} -e test@domain.test -r http://localhost:${port}`);
}
