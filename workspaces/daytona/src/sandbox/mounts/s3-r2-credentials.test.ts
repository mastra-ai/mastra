import { describe, expect, it } from 'vitest';

import { createR2TemporaryCredentials } from './s3-r2-credentials';

describe('createR2TemporaryCredentials', () => {
  it('preserves the Node-generated JWT signature and derived secret formats', async () => {
    const unsigned = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyMmJ1Y2tldCIsImlhdCI6MTcwMDAwMDAwMH0';

    await expect(createR2TemporaryCredentials(unsigned, 'test-secret')).resolves.toEqual({
      jwt: `${unsigned}.MJja5p6ZFr4P8wxIGL-EIlgr__qlVNlfqiueK1Aw7RU`,
      secretAccessKey: 'dbbd606368c43c62d33a96ebe3e51b635ea4bf29bd3b90331d4e2922e2cd380d',
    });
  });
});
