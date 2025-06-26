import type { Transform } from 'node:stream';
import type { LoggerTransport } from '@mastra/core/logger';

export const createCustomTransport = (
  stream: Transform,
  getLogs?: LoggerTransport['getLogs'],
  getLogsByRunId?: LoggerTransport['getLogsByRunId'],
) => {
  let transport = stream as LoggerTransport;
  if (getLogs) {
    transport.getLogs = getLogs;
  }
  if (getLogsByRunId) {
    transport.getLogsByRunId = getLogsByRunId;
  }
  return transport as LoggerTransport;
};
