import { describe, expect, it } from 'vitest';

import { validateGCSBucketName, validateS3BucketName } from './types';

describe('bucket name validation', () => {
  it('allows underscores in GCS bucket names', () => {
    expect(() => validateGCSBucketName('my_gcs_bucket')).not.toThrow();
  });

  it('rejects underscores in S3 bucket names', () => {
    expect(() => validateS3BucketName('my_s3_bucket')).toThrow('Invalid S3 bucket name');
  });
});
