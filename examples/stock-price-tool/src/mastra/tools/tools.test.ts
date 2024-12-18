import { describe, it, expect } from '@jest/globals';

import { getStockPrice } from '.';

describe('Test Tools', () => {
  it('should run the stockPrices', async () => {
    const result = await getStockPrice('AAPL');

    console.log(result);
    expect(result).toBeDefined();
  });
});
