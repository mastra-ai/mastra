import { beforeEach, describe, it, expect } from '@jest/globals';

import { mastra } from '../index';

describe('Hotel Tools', () => {
  let searchHotelsTool: any;

  beforeEach(() => {
    searchHotelsTool = mastra.getTool('searchHotels');
  });

  it('should search for hotels', async () => {
    const result = await searchHotelsTool.execute({
      location: 'Chicago',
    });

    console.log('Hotels Search Result in Test: ', result);
    expect(result).toBeDefined();
  });
});
