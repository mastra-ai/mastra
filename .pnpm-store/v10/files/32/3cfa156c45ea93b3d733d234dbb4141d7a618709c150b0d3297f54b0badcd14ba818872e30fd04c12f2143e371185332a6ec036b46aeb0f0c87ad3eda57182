// @flow

import type {
  WriterType,
} from '../types';

const createBlockingWriter = (stream: stream$Writable): WriterType => {
  return {
    write: (message: string) => {
      stream.write(message + '\n');
    },
  };
};

export default (): WriterType => {
  // eslint-disable-next-line no-process-env
  const targetStream = (process.env.ROARR_STREAM || 'STDOUT').toUpperCase();

  const stream = targetStream.toUpperCase() === 'STDOUT' ? process.stdout : process.stderr;

  return createBlockingWriter(stream);
};
