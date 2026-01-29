import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  requestContextSchema: z.object({
    userId: z.string(),
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
    console.log(`[calculator_add] Adding ${a} + ${b}`);
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
    console.log(`[calculator_multiply] Multiplying ${a} * ${b}`);
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
    console.log(`[calculator_divide] Dividing ${dividend} / ${divisor}`);
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
    console.log(`[get_stock_price] Fetching price for ${ticker}`);
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
    console.log(`[translate_text] Translating to ${targetLanguage}: "${text}"`);
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
    console.log(`[send_notification] Sending ${priority} priority notification to ${recipient}: "${message}"`);
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
    console.log(`[search_database] Searching for: "${query}" (limit: ${limit})`);
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
    console.log(`[generate_report] Generating ${reportType} report for ${dateRange}`);
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
    console.log(`[schedule_reminder] Scheduling reminder: "${title}" for ${time}`);
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
    console.log(`[convert_units] Converting ${value} ${fromUnit} to ${toUnit}`);
    // Simple mock conversions
    let result = value;
    if (fromUnit === 'miles' && toUnit === 'km') result = value * 1.60934;
    if (fromUnit === 'kg' && toUnit === 'lbs') result = value * 2.20462;
    if (fromUnit === 'celsius' && toUnit === 'fahrenheit') result = (value * 9) / 5 + 32;
    return { original: { value, unit: fromUnit }, converted: { value: result, unit: toUnit } };
  },
});
