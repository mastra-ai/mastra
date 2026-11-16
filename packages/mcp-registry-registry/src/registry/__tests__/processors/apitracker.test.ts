import { describe, it, expect } from 'vitest';
import { processApiTrackerServers } from '../../processors/apitracker';

describe('APITracker processor', () => {
  it('should handle empty or invalid data', () => {
    // Test with null
    expect(processApiTrackerServers(null)).toEqual([]);

    // Test with undefined
    expect(processApiTrackerServers(undefined)).toEqual([]);

    // Test with non-object
    expect(processApiTrackerServers('not an object')).toEqual([]);

    // Test with empty object
    expect(processApiTrackerServers({})).toEqual([]);

    // Test with empty array
    expect(processApiTrackerServers([])).toEqual([]);
  });
});
