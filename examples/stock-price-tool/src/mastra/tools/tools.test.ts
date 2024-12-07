import { beforeEach, describe, it, expect } from '@jest/globals';

import { mastra } from '..';

describe('Test Tools', () => {
  let stockPricesTool: any;

  beforeEach(() => {
    stockPricesTool = mastra.getTool('stockPrices'); // get the tool by name
  });

  it('should run the stockPrices', async () => {
    const result = await stockPricesTool.execute({
      symbol: 'AAPL',
    });

    console.log(result);
    expect(result).toBeDefined();
  });
});
