import { describe, expect, it } from 'vitest';

import { validateGCSBucketName, validateOwner, validateS3BucketName } from './types';

describe('bucket name validation', () => {
  it('allows underscores in GCS bucket names', () => {
    expect(() => validateGCSBucketName('my_gcs_bucket')).not.toThrow();
  });

  it('rejects underscores in S3 bucket names', () => {
    expect(() => validateS3BucketName('my_s3_bucket')).toThrow('Invalid S3 bucket name');
  });
});

describe('mount owner validation', () => {
  it('accepts numeric uid and gid', () => {
    expect(() => validateOwner({ uid: 1000, gid: 1000 })).not.toThrow();
  });

  it('accepts uid and gid of 0', () => {
    expect(() => validateOwner({ uid: 0, gid: 0 })).not.toThrow();
  });

  it('rejects undefined', () => {
    expect(() => validateOwner(undefined)).toThrow('Invalid mount owner');
  });

  it('rejects a missing gid', () => {
    expect(() => validateOwner({ uid: 1000 })).toThrow('Invalid mount owner');
  });

  it('rejects a negative uid', () => {
    expect(() => validateOwner({ uid: -1, gid: 1000 })).toThrow('Invalid mount owner');
  });

  it('rejects a non-integer gid', () => {
    expect(() => validateOwner({ uid: 1000, gid: 1.5 })).toThrow('Invalid mount owner');
  });

  it('rejects string ids', () => {
    expect(() => validateOwner({ uid: '1000', gid: '1000' })).toThrow('Invalid mount owner');
  });
});
