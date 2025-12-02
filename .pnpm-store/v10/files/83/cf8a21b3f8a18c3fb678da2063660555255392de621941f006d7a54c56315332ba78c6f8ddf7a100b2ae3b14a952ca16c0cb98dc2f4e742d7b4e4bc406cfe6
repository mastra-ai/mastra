"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

const createBlockingWriter = stream => {
  return {
    write: message => {
      stream.write(message + '\n');
    }
  };
};

const createNodeWriter = () => {
  // eslint-disable-next-line no-process-env
  const targetStream = (process.env.ROARR_STREAM || 'STDOUT').toUpperCase();
  const stream = targetStream.toUpperCase() === 'STDOUT' ? process.stdout : process.stderr;
  return createBlockingWriter(stream);
};

var _default = createNodeWriter;
exports.default = _default;
//# sourceMappingURL=createNodeWriter.js.map