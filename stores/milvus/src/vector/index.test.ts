import { describe, it } from 'vitest';
import { connect } from './index';

describe('Milvus Vector tests', () => {
  it('should connect to local milvus db instance', async () => {
    await connect();
  });
});
