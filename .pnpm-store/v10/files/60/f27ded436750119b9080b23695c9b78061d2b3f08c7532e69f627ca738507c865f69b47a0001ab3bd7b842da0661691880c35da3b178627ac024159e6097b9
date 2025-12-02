// @flow
'use strict';
const crossSpawn = require('cross-spawn');
const { onExit } = require('signal-exit')
const EventEmitter = require('events');
const ChildProcessPromise = require('./promise');

const activeProcesses = new Set();

onExit(() => {
  for (let child of activeProcesses) {
    child.kill('SIGTERM');
  }
});

function spawn(
  cmd /*: string */,
  args /*:: ?: Array<string> */,
  opts /*:: ?: child_process$spawnOpts */
) /*: ChildProcessPromise */ {
  return new ChildProcessPromise((resolve, reject, events) => {
    let child = crossSpawn(cmd, args, opts);
    let stdout = Buffer.from('');
    let stderr = Buffer.from('');

    activeProcesses.add(child);

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout = Buffer.concat([stdout, data]);
        events.emit('stdout', data);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr = Buffer.concat([stderr, data]);
        events.emit('stderr', data);
      });
    }

    child.on('error', err => {
      activeProcesses.delete(child);
      reject(err);
    });

    child.on('close', code => {
      activeProcesses.delete(child);
      resolve({ code, stdout, stderr });
    });
  });
}

module.exports = spawn;
module.exports.ChildProcessPromise = ChildProcessPromise;
