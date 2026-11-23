import { describe, expect, it } from 'vitest';
import { isEuRegion } from './platform-region';

describe('isEuRegion', () => {
  it.each(['ams', 'eu', ' EU ', 'europe-west4'])('treats %j as EU', region => {
    expect(isEuRegion(region)).toBe(true);
  });

  it.each(['pdx', 'iad', 'sfo', 'us', 'us-west1', '', null, undefined])('treats %j as not EU', region => {
    expect(isEuRegion(region)).toBe(false);
  });
});
