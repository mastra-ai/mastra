import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  requestContextSchema: z.object({
    userId: z.string().default('default-user-id'),
  }),
  execute: async (inputData, { requestContext }) => {
    const userId = requestContext?.get('userId');
    console.log('My cooking tool is running!', inputData.ingredient, userId);
    return `My tool result: ${inputData.ingredient} from ${userId}`;
  },
});

// ============================================
// Demo tools for Dynamic Tools Agent example
// ============================================

export const calculatorAdd = createTool({
  id: 'calculator_add',
  description: 'Add two numbers together. Use this for addition calculations.',
  inputSchema: z.object({
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ a, b }) => {
    return { result: a + b, operation: 'addition' };
  },
});

export const calculatorMultiply = createTool({
  id: 'calculator_multiply',
  description: 'Multiply two numbers. Use this for multiplication calculations.',
  inputSchema: z.object({
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ a, b }) => {
    return { result: a * b, operation: 'multiplication' };
  },
});

export const calculatorDivide = createTool({
  id: 'calculator_divide',
  description: 'Divide one number by another. Use this for division calculations.',
  inputSchema: z.object({
    dividend: z.number().describe('The number to be divided'),
    divisor: z.number().describe('The number to divide by'),
  }),
  execute: async ({ dividend, divisor }) => {
    if (divisor === 0) {
      return { error: 'Cannot divide by zero' };
    }
    return { result: dividend / divisor, operation: 'division' };
  },
});

export const getStockPrice = createTool({
  id: 'get_stock_price',
  description: 'Get the current stock price for a ticker symbol like AAPL, GOOGL, MSFT.',
  inputSchema: z.object({
    ticker: z.string().describe('Stock ticker symbol (e.g., AAPL, GOOGL)'),
  }),
  execute: async ({ ticker }) => {
    // Mock stock prices
    const prices: Record<string, number> = {
      AAPL: 178.5,
      GOOGL: 141.25,
      MSFT: 378.9,
      AMZN: 178.35,
      TSLA: 248.5,
    };
    const price = prices[ticker.toUpperCase()] || Math.random() * 500;
    return { ticker: ticker.toUpperCase(), price, currency: 'USD' };
  },
});

export const translateText = createTool({
  id: 'translate_text',
  description:
    'Translate text from one language to another. Supports common languages like Spanish, French, German, Japanese.',
  inputSchema: z.object({
    text: z.string().describe('Text to translate'),
    targetLanguage: z.string().describe('Target language (e.g., spanish, french, german)'),
  }),
  execute: async ({ text, targetLanguage }) => {
    // Mock translation - just returns a message
    return {
      original: text,
      translated: `[${targetLanguage.toUpperCase()}] ${text}`,
      targetLanguage,
    };
  },
});

export const sendNotification = createTool({
  id: 'send_notification',
  description: 'Send a notification message to a user or channel.',
  inputSchema: z.object({
    recipient: z.string().describe('Who to send the notification to'),
    message: z.string().describe('The notification message'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level'),
  }),
  execute: async ({ recipient, message, priority = 'medium' }) => {
    return { sent: true, recipient, priority, timestamp: new Date().toISOString() };
  },
});

export const searchDatabase = createTool({
  id: 'search_database',
  description: 'Search a database for records matching a query. Returns matching results.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Maximum number of results'),
  }),
  execute: async ({ query, limit = 10 }) => {
    // Mock database results
    return {
      query,
      results: [
        { id: 1, name: `Result for "${query}" #1` },
        { id: 2, name: `Result for "${query}" #2` },
      ],
      totalFound: 2,
    };
  },
});

export const generateReport = createTool({
  id: 'generate_report',
  description: 'Generate a report based on specified parameters. Can create sales, performance, or summary reports.',
  inputSchema: z.object({
    reportType: z.enum(['sales', 'performance', 'summary']).describe('Type of report to generate'),
    dateRange: z.string().optional().describe('Date range for the report'),
  }),
  execute: async ({ reportType, dateRange = 'last 30 days' }) => {
    return {
      reportType,
      dateRange,
      generatedAt: new Date().toISOString(),
      summary: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully`,
    };
  },
});

export const scheduleReminder = createTool({
  id: 'schedule_reminder',
  description: 'Schedule a reminder for a specific time. Set reminders for tasks, meetings, or deadlines.',
  inputSchema: z.object({
    title: z.string().describe('Reminder title'),
    time: z.string().describe('When to remind (e.g., "in 1 hour", "tomorrow at 9am")'),
  }),
  execute: async ({ title, time }) => {
    return {
      scheduled: true,
      title,
      scheduledFor: time,
      reminderId: `reminder_${Date.now()}`,
    };
  },
});

export const convertUnits = createTool({
  id: 'convert_units',
  description: 'Convert between different units of measurement. Supports length, weight, temperature conversions.',
  inputSchema: z.object({
    value: z.number().describe('The value to convert'),
    fromUnit: z.string().describe('Source unit (e.g., miles, kg, celsius)'),
    toUnit: z.string().describe('Target unit (e.g., km, lbs, fahrenheit)'),
  }),
  execute: async ({ value, fromUnit, toUnit }) => {
    // Simple mock conversions
    let result = value;
    if (fromUnit === 'miles' && toUnit === 'km') result = value * 1.60934;
    if (fromUnit === 'kg' && toUnit === 'lbs') result = value * 2.20462;
    if (fromUnit === 'celsius' && toUnit === 'fahrenheit') result = (value * 9) / 5 + 32;
    return { original: { value, unit: fromUnit }, converted: { value: result, unit: toUnit } };
  },
});

// ==============================================
// Subscription Management Tools (in-memory store)
// ==============================================

interface Subscription {
  id: string;
  name: string;
  plan: string;
  price: number;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

const subscriptionStore = new Map<string, Subscription>();

export const createSubscription = createTool({
  id: 'create_subscription',
  description: 'Create a new subscription for a user. Returns the created subscription with its ID.',
  inputSchema: z.object({
    name: z.string().describe('Name for the subscription (e.g., "Netflix", "Spotify")'),
    plan: z.string().describe('Plan tier (e.g., "basic", "premium", "enterprise")'),
    price: z.number().describe('Monthly price in USD'),
  }),
  execute: async ({ name, plan, price }) => {
    const id = `sub_${Date.now()}`;
    const now = new Date().toISOString();
    const subscription: Subscription = {
      id,
      name,
      plan,
      price,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    subscriptionStore.set(id, subscription);
    return { success: true, subscription };
  },
});

export const getSubscription = createTool({
  id: 'get_subscription',
  description: 'Get a subscription by its ID.',
  inputSchema: z.object({
    id: z.string().describe('The subscription ID (e.g., "sub_123456")'),
  }),
  execute: async ({ id }) => {
    const subscription = subscriptionStore.get(id);
    if (!subscription) {
      return { success: false, error: `Subscription ${id} not found` };
    }
    return { success: true, subscription };
  },
});

export const listSubscriptions = createTool({
  id: 'list_subscriptions',
  description: 'List all subscriptions. Optionally filter by status.',
  inputSchema: z.object({
    status: z.enum(['active', 'paused', 'cancelled']).optional().describe('Filter by subscription status'),
  }),
  execute: async ({ status }) => {
    let subscriptions = Array.from(subscriptionStore.values());
    if (status) {
      subscriptions = subscriptions.filter(s => s.status === status);
    }
    return {
      success: true,
      subscriptions,
      total: subscriptions.length,
    };
  },
});

export const updateSubscription = createTool({
  id: 'update_subscription',
  description: 'Update an existing subscription. Can change the plan, price, or status.',
  inputSchema: z.object({
    id: z.string().describe('The subscription ID to update'),
    plan: z.string().optional().describe('New plan tier'),
    price: z.number().optional().describe('New monthly price'),
    status: z.enum(['active', 'paused', 'cancelled']).optional().describe('New status'),
  }),
  execute: async ({ id, plan, price, status }) => {
    const subscription = subscriptionStore.get(id);
    if (!subscription) {
      return { success: false, error: `Subscription ${id} not found` };
    }
    if (plan !== undefined) subscription.plan = plan;
    if (price !== undefined) subscription.price = price;
    if (status !== undefined) subscription.status = status;
    subscription.updatedAt = new Date().toISOString();
    subscriptionStore.set(id, subscription);
    return { success: true, subscription };
  },
});

export const deleteSubscription = createTool({
  id: 'delete_subscription',
  description: 'Delete a subscription by its ID.',
  inputSchema: z.object({
    id: z.string().describe('The subscription ID to delete'),
  }),
  execute: async ({ id }) => {
    const existed = subscriptionStore.delete(id);
    return { success: existed, message: existed ? `Subscription ${id} deleted` : `Subscription ${id} not found` };
  },
});

// =============================================================================
// Background Tasks — Crypto Tools
// Uses CoinGecko's free API (no API key required)
// =============================================================================

/**
 * Deep crypto research tool — fetches comprehensive coin data from CoinGecko.
 * This is a heavier call that returns description, market data, links, categories, etc.
 * Configured with `background: { enabled: true }` so the agent dispatches it
 * to run asynchronously while continuing the conversation.
 */
export const cryptoResearchTool = createTool({
  id: 'crypto-research',
  description:
    'Performs deep research on a cryptocurrency. Fetches comprehensive data including description, ' +
    'market stats, price history, developer activity, and community links. Use this when the user ' +
    'asks to research or analyze a specific cryptocurrency in depth.',
  inputSchema: z.object({
    coinId: z
      .string()
      .describe(
        'The CoinGecko coin ID (e.g. "bitcoin", "ethereum", "solana", "dogecoin"). Use lowercase, hyphenated names.',
      ),
  }),
  outputSchema: z.object({
    name: z.string(),
    symbol: z.string(),
    description: z.string(),
    marketCapRank: z.number().nullable(),
    currentPrice: z.number().nullable(),
    marketCap: z.number().nullable(),
    totalVolume: z.number().nullable(),
    high24h: z.number().nullable(),
    low24h: z.number().nullable(),
    priceChangePercentage24h: z.number().nullable(),
    priceChangePercentage7d: z.number().nullable(),
    priceChangePercentage30d: z.number().nullable(),
    allTimeHigh: z.number().nullable(),
    allTimeHighDate: z.string().nullable(),
    circulatingSupply: z.number().nullable(),
    totalSupply: z.number().nullable(),
    categories: z.array(z.string()),
    homepage: z.string().nullable(),
    subreddit: z.string().nullable(),
  }),
  execute: async ({ coinId }) => {
    await new Promise(resolve => setTimeout(resolve, 30000));
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const market = data.market_data || {};

    // await new Promise(resolve => setTimeout(resolve, 15000));

    return {
      name: data.name || coinId,
      symbol: (data.symbol || '').toUpperCase(),
      description: (data.description?.en || 'No description available.').slice(0, 1000),
      marketCapRank: data.market_cap_rank ?? null,
      currentPrice: market.current_price?.usd ?? null,
      marketCap: market.market_cap?.usd ?? null,
      totalVolume: market.total_volume?.usd ?? null,
      high24h: market.high_24h?.usd ?? null,
      low24h: market.low_24h?.usd ?? null,
      priceChangePercentage24h: market.price_change_percentage_24h ?? null,
      priceChangePercentage7d: market.price_change_percentage_7d ?? null,
      priceChangePercentage30d: market.price_change_percentage_30d ?? null,
      allTimeHigh: market.ath?.usd ?? null,
      allTimeHighDate: market.ath_date?.usd ?? null,
      circulatingSupply: market.circulating_supply ?? null,
      totalSupply: market.total_supply ?? null,
      categories: data.categories?.filter(Boolean) ?? [],
      homepage: data.links?.homepage?.[0] || null,
      subreddit: data.links?.subreddit_url || null,
    };
  },
  // Runs in the background — agent continues the conversation while this fetches
  // background: { enabled: true },
});

/**
 * Quick crypto price lookup — fetches just the current price and basic stats.
 * Uses CoinGecko's lightweight /simple/price endpoint.
 * Runs in the foreground (no background config) since it's fast.
 */
export const cryptoPriceTool = createTool({
  id: 'crypto-price',
  description:
    'Quickly looks up the current price and basic market stats for one or more cryptocurrencies. ' +
    'Use this for fast price checks when the user asks "what is the price of X".',
  inputSchema: z.object({
    coinIds: z
      .string()
      .describe(
        'Comma-separated CoinGecko coin IDs (e.g. "bitcoin", "bitcoin,ethereum,solana"). Use lowercase, hyphenated names.',
      ),
  }),
  outputSchema: z.object({
    prices: z.array(
      z.object({
        id: z.string(),
        priceUsd: z.number(),
        marketCap: z.number(),
        volume24h: z.number(),
        change24h: z.number(),
      }),
    ),
  }),
  execute: async ({ coinIds }) => {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinIds)}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const prices = Object.entries(data).map(([id, values]: [string, any]) => ({
      id,
      priceUsd: values.usd ?? 0,
      marketCap: values.usd_market_cap ?? 0,
      volume24h: values.usd_24h_vol ?? 0,
      change24h: values.usd_24h_change ?? 0,
    }));

    return { prices };
  },
  // No background config — runs in foreground (fast endpoint)
});
