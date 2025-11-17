import {LibSQLStore} from '@mastra/libsql';
import config from 'config';
import {rootLogger} from './logger';
import {MastraStorage} from '@mastra/core/storage';

const logger = rootLogger.child({
  component: 'storage',
});

type StorageConfig = {
  type: 'libsql';
  url?: string;
};

/**
 *
 * @param namespace the namespace of the storage, can be used to separate different apps
 * @returns
 */
export const createStorage = (namespace: string): MastraStorage => {
  const storageConfig = config.get<StorageConfig>('storage');
  if (storageConfig.url) {
    logger.info({namespace}, 'Creating LibSQL storage');
    return new LibSQLStore({id: namespace, url: storageConfig.url});
  }
  logger.info({namespace}, 'Creating memory storage');
  return new LibSQLStore({id: namespace, url: ':memory:'});
};
