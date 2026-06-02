import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createCodeMode } from '@mastra/core/tools';
import { LocalSandbox } from '@mastra/core/workspace';
import {
  getCustomer,
  getCustomerLifetimeValue,
  getSupplier,
  listProducts,
  listRecentOrders,
} from '../tools/sales-analytics-tools';

/**
 * Code Mode demo agent.
 *
 * Instead of exposing tools directly, we pass them into `createCodeMode`. Each
 * call returns ONE tool plus generated `instructions` that describe its tools as
 * typed `external_*` functions. The model writes a single TypeScript program
 * that batches calls with Promise.all and does arithmetic in JS, collapsing an
 * N+1 task into one tool call. Each `external_*` call runs the real Mastra tool
 * on the host (input validation, request context, and tracing preserved).
 *
 * This agent has TWO Code Mode tools, each scoped to a different subset of tools:
 *   - `sales_code` can only orchestrate the order/customer tools.
 *   - `inventory_code` can only orchestrate the product/supplier tools.
 *
 * The allow-list is per tool: a program run by `sales_code` literally cannot call
 * an inventory tool, and vice versa. Distinct `id`s keep them from colliding
 * (the default is `execute_typescript`). The two tools share one
 * sandbox here, but each could have its own.
 */
const sandbox = new LocalSandbox();

const sales = createCodeMode({
  id: 'sales_code',
  tools: {
    listRecentOrders,
    getCustomer,
    getCustomerLifetimeValue,
  },
  // Explicit, deliberate local execution: the program runs as a host `node`
  // process. Fine for this trusted demo; use a remote/isolated sandbox in prod.
  sandbox,
});

const inventory = createCodeMode({
  id: 'inventory_code',
  tools: {
    listProducts,
    getSupplier,
  },
  sandbox,
});

export const codeModeAgent = new Agent({
  id: 'code-mode-agent',
  name: 'Code Mode Analytics Agent',
  description:
    'A sales + inventory assistant that uses Code Mode to orchestrate tools in a single sandboxed program, with separate code tools scoped to each domain.',
  instructions: [
    'You are a sales and inventory assistant.',
    'When a question requires combining multiple tool calls, batching, or arithmetic, write a single TypeScript program and run it rather than calling tools one at a time.',
    'Use sales_code for order/customer questions and inventory_code for product/supplier questions.',
    sales.instructions,
    inventory.instructions,
  ].join('\n\n'),
  model: 'openai/gpt-5.4-mini',
  tools: {
    sales_code: sales.tool,
    inventory_code: inventory.tool,
  },
  memory: new Memory(),
});
