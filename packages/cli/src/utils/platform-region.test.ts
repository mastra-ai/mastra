import { describe, expect, it } from 'vitest';
import { DEPLOY_REGIONS, isDeployRegion, isEuRegion } from './platform-region';

describe('isEuRegion', () => {
  it.each(['ams', 'eu', ' EU ', 'europe-west4'])('treats %j as EU', region => {
    expect(isEuRegion(region)).toBe(true);
  });

  it.each(['pdx', 'iad', 'sfo', 'us', 'us-west1', '', null, undefined])('treats %j as not EU', region => {
    expect(isEuRegion(region)).toBe(false);
  });
});

describe('isDeployRegion', () => {
  it('lists the shorthands and canonical Railway regions', () => {
    expect(DEPLOY_REGIONS).toEqual(['us', 'eu', 'pdx', 'iad', 'sfo', 'ams']);
  });

  it.each(DEPLOY_REGIONS)('accepts %j', region => {
    expect(isDeployRegion(region)).toBe(true);
  });

  it.each(['sin', 'EU', ' us', 'us-west1', 'europe-west4', ''])('rejects %j', region => {
    expect(isDeployRegion(region)).toBe(false);
  });
});
