import { beforeEach, describe, it, expect } from '@jest/globals';

import { mastra } from '../index';

describe('Flight Tools', () => {
  let searchFlightsTool: any;

  beforeEach(() => {
    searchFlightsTool = mastra.getTool('searchFlights');
  });

  it('should search for flights between two cities', async () => {
    const result = await searchFlightsTool.execute({
      startDate: '12/01/2024',
      endDate: '12/02/2024',
      origin: 'Chicago',
      destination: 'San Francisco',
    });

    expect(result).toBeDefined();
    // Add more specific assertions based on your expected flight search response
    expect(Array.isArray(result.flights)).toBe(true);
    expect(result.flights.length).toBeGreaterThan(0);

    // Test the structure of a flight result
    const flight = result.flights[0];
    expect(flight).toHaveProperty('departure');
    expect(flight).toHaveProperty('arrival');
    expect(flight).toHaveProperty('price');
  });
});
