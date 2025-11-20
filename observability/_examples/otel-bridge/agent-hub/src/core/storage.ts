import {LibSQLStore} from '@mastra/libsql';
import {rootLogger} from './logger';
import {MastraStorage} from '@mastra/core/storage';

const logger = rootLogger.child({
  component: 'storage',
});

/**
 *
 * @param namespace the namespace of the storage, can be used to separate different apps
 * @returns
 */
export const createStorage = (namespace: string): MastraStorage => {
  logger.info({namespace}, 'Creating memory storage');
  return new LibSQLStore({id: namespace, url: ':memory:'});
};
