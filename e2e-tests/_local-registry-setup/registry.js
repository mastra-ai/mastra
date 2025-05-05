import { fork, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

if (typeof require === 'undefined') {
  global.require = createRequire(import.meta.url);
}

/**
 *
 * @param {string} verdaccioPath
 * @param {*} args
 * @param {*} childOptions
 * @returns {Promise<import('child_process').ChildProcess>}
 */
export function runRegistry(verdaccioPath, args = [], childOptions) {
  return new Promise((resolve, reject) => {
    const childFork = fork(verdaccioPath, args, {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      ...childOptions,
    });
    childFork.on('message', msg => {
      if (msg.verdaccio_started) {
        setImmediate(() => {
          resolve(childFork);
        });
      }
    });

    childFork.on('error', err => reject([err]));
    childFork.on('disconnect', err => reject([err]));
  });
}

export async function startRegistry(verdaccioPath, port, location = process.cwd()) {
  const registry = await runRegistry(verdaccioPath, ['-c', './verdaccio.yaml', '-l', `${port}`], {
    cwd: location,
  });
  login('mastra', 'mastra-ai', port);

  return new Proxy(registry, {
    get(target, prop) {
      if (prop === 'toString') {
        return () => `http://localhost:${port}`;
      }

      return Reflect.get(target, prop);
    },
  });
}

export function login(user, password, port) {
  execSync(`npx npm-cli-login -u ${user} -p ${password} -e test@domain.test -r http://localhost:${port}`);
}
