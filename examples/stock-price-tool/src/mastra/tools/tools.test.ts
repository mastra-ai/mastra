import { describe, it, expect } from 'vitest';

import { getStockPrice } from './stock-price';

describe('Test Tools', () => {
  it('should run the stockPrices', async () => {
    const result = await getStockPrice('AAPL');

    console.log(result);
    expect(result).toBeDefined();
  });
});
