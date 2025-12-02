'use strict';
const EventEmitter = require('events');

class ChildProcessPromise extends Promise {
  constructor(executer) {
    let resolve;
    let reject;

    super((res, rej) => {
      resolve = res;
      reject = rej;
    });

    executer(resolve, reject, this);
  }
}

Object.assign(ChildProcessPromise.prototype, EventEmitter.prototype);

module.exports = ChildProcessPromise;
