import { createTool } from '@mastra/core';
import { z } from 'zod';

export const searchCryptoCoins = createTool({
  label: 'Search crypto coins',
  schema: z.object({ keyword: z.string() }),
  description: 'Search all available crypto coins by a keyword',
  executor: async (params) => {
    const {
      data: { keyword },
    } = params;
    const coinListUrl = `https://api.coingecko.com/api/v3/coins/list`;

    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!,
      },
    };

    const response = await fetch(coinListUrl, options);
    const data = await response.json();

    // First try to find an exact match.
    const exactMatch = data.find(
      (coin: any) => coin.name.toLowerCase() === keyword.toLowerCase()
    );

    if (exactMatch) {
      console.log('searchCryptoCoins exactMatch', exactMatch);
      return exactMatch;
    }

    // If no exact match is found, return first coin that contains the keyword.
    const coin = data.filter((coin: any) =>
      coin.name.toLowerCase().includes(keyword.toLowerCase())
    );

    if (coin.length >= 0) {
      console.log('searchCryptoCoins containsMatch', coin[0]);
      return coin[0];
    }

    return null;
  },
});

export const getCryptoPrice = createTool({
  label: 'Get crypto price by id',
  schema: z.object({ id: z.string() }),
  description: 'Get crypto price by id',
  executor: async ({ data: { id } }) => {
    const coinListUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}`;

    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!,
      },
    };

    const response = await fetch(coinListUrl, options);
    const data = await response.json();

    if (data.length === 0) {
      return null;
    }

    return data[0];
  },
});

export const getHistoricalCryptoPrices = createTool({
  label: 'Get historical crypto prices for use in a chart',
  schema: z.object({ id: z.string(), days: z.number() }),
  description: 'Get historical crypto prices for use in a chart',
  executor: async ({ data: { id, days } }) => {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;

    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!,
      },
    };

    const response = await fetch(url, options);
    const data = await response.json();

    return data.prices.map((price: number[]) => ({
      timestamp: price[0],
      price: price[1],
    }));
  },
});
