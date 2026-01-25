/**
 * Dynamic Tools Agent Example
 *
 * This agent demonstrates the dynamic tool search pattern where tools are
 * discovered and loaded on demand rather than being available upfront.
 *
 * Benefits:
 * - Reduces context token usage by ~94% when working with many tools
 * - Agent discovers tools as needed rather than having all definitions loaded
 * - Tools are loaded per-conversation and persist across turns
 *
 * Usage:
 * 1. Agent starts with only search_tools and load_tool
 * 2. When agent needs a capability, it searches for relevant tools
 * 3. Agent loads the tool by name
 * 4. On subsequent turns, loaded tools are available via toolsets
 */

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { createDynamicToolSet } from '@mastra/core/tools/dynamic';

import {
  calculatorAdd,
  calculatorMultiply,
  calculatorDivide,
  getStockPrice,
  translateText,
  sendNotification,
  searchDatabase,
  generateReport,
  scheduleReminder,
  convertUnits,
  cookingTool,
} from '../tools/index.js';

// Create the dynamic tool set with all searchable tools
// These tools are NOT loaded by default - they must be searched and loaded
export const { searchTool, loadTool, getLoadedTools, registry } = createDynamicToolSet({
  tools: {
    // Calculator tools
    calculator_add: calculatorAdd,
    calculator_multiply: calculatorMultiply,
    calculator_divide: calculatorDivide,

    // Utility tools
    get_stock_price: getStockPrice,
    translate_text: translateText,
    send_notification: sendNotification,
    search_database: searchDatabase,
    generate_report: generateReport,
    schedule_reminder: scheduleReminder,
    convert_units: convertUnits,
    cooking_tool: cookingTool,
  },
  search: {
    topK: 5, // Return top 5 matches
  },
});

/**
 * The Dynamic Tools Agent
 *
 * This agent only has search_tools and load_tool available initially.
 * It must discover and load other tools as needed.
 *
 * The tools function dynamically includes any tools that have been loaded
 * for the current thread, making them available on subsequent turns.
 */
export const dynamicToolsAgent = new Agent({
  id: 'dynamic-tools-agent',
  name: 'Dynamic Tools Agent',
  description: 'An agent that dynamically discovers and loads tools on demand, reducing context usage.',
  instructions: `You are a helpful assistant with access to a large library of tools.

IMPORTANT: You do NOT have direct access to most tools. Instead, you have two special tools:

1. **search_tools**: Use this to search for tools by keyword when you need a capability.
   - Example: If asked to do math, search for "calculator" or "add"
   - Example: If asked about stocks, search for "stock price"

2. **load_tool**: After finding a useful tool, use this to load it by exact name.
   - The tool will be available on your NEXT response.

WORKFLOW:
1. When you need a capability you don't have, use search_tools first
2. Review the search results and pick the most relevant tool
3. Use load_tool to load it
4. Tell the user the tool is now loaded and they can ask again
5. On subsequent messages, use the loaded tool normally

Example conversation:
User: "What's 5 + 3?"
You: [search_tools for "add" or "calculator"] -> finds calculator_add
You: [load_tool for "calculator_add"] -> tool is now loading
You: "I've found and loaded a calculator tool. Let me add those numbers for you now."
[On next turn, calculator_add is available]

Be proactive about searching for tools when you don't have the capability the user needs.`,
  model: openai('gpt-4o-mini'),
  tools: async ({ requestContext }) => {
    // Get the threadId from requestContext (set by the agent framework)
    // Use type assertion because the requestContext generic type is unknown
    const threadId = (requestContext as { get(key: string): unknown }).get(MASTRA_THREAD_ID_KEY) as
      | string
      | undefined;

    // Get any tools that have been loaded for this thread
    const loadedTools = await getLoadedTools({ threadId });

    return {
      // Always available: search and load tools
      search_tools: searchTool,
      load_tool: loadTool,
      // Dynamically loaded tools for this thread
      ...loadedTools,
    };
  },
});
