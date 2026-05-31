/**
 * Code Mode demo / test script.
 *
 * Run with: npx tsx src/test-code-mode.ts
 *
 * Part 1 needs NO API key: it calls the `execute_typescript` tool directly with a
 * hand-written program — exactly the kind of program the model is expected to
 * produce. It proves the N+1 collapse: one tool call fans out to many external_*
 * tool calls (batched with Promise.all), does arithmetic in JS, and returns one
 * aggregated result. The real Mastra tools run on the host with validation intact.
 *
 * Part 2 shows a SECOND Code Mode tool scoped to a different subset of tools,
 * and proves the per-tool allow-list keeps the two from reaching each other.
 *
 * Part 3 runs the actual agent (needs OPENAI_API_KEY) and prints which tools it
 * called — you should see a single code-mode call.
 */

import { createCodeMode } from '@mastra/core/tools';
import { LocalSandbox } from '@mastra/core/workspace';
import {
  getCustomer,
  getCustomerLifetimeValue,
  getSupplier,
  listProducts,
  listRecentOrders,
} from './mastra/tools/sales-analytics-tools';
import { codeModeAgent } from './mastra/agents/code-mode-agent';

const line = () => console.log('='.repeat(60));

async function runDirect() {
  line();
  console.log('Part 1 — direct execute_typescript call (no API key needed)');
  line();

  const { tool, instructions } = createCodeMode({
    tools: { listRecentOrders, getCustomer, getCustomerLifetimeValue },
    sandbox: new LocalSandbox(),
  });

  console.log('\n--- Generated instructions the model would see ---\n');
  console.log(instructions);

  // The program a capable model would write for:
  // "For the 5 most recent orders, give me each customer's name, tier, and
  //  lifetime value, plus the average lifetime value across them."
  const program = `
    const { orders } = await external_listRecentOrders({ limit: 5 });
    console.log('fetched', orders.length, 'orders');

    // Unique customers across the recent orders.
    const customerIds = [...new Set(orders.map((o) => o.customerId))];

    // Batch all per-customer lookups in parallel — this is the N+1 collapse.
    const rows = await Promise.all(
      customerIds.map(async (id) => {
        const [profile, ltv] = await Promise.all([
          external_getCustomer({ customerId: id }),
          external_getCustomerLifetimeValue({ customerId: id }),
        ]);
        return { name: profile.name, tier: profile.tier, lifetimeValue: ltv.lifetimeValue };
      })
    );

    const avg = rows.reduce((sum, r) => sum + r.lifetimeValue, 0) / rows.length;
    return { customers: rows, averageLifetimeValue: Math.round(avg * 100) / 100 };
  `;

  const result = await tool.execute({ code: program }, {
    observe: { span: async (_n: string, fn: () => any) => fn(), log: () => {} },
  } as any);

  console.log('\n--- Result of the single execute_typescript call ---\n');
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    throw new Error('Direct execution failed: ' + JSON.stringify(result.error));
  }
}

async function runInventorySubset() {
  line();
  console.log('Part 2 — a SECOND Code Mode tool, scoped to a different subset');
  line();

  // A separate code tool that can only orchestrate the inventory tools. Its
  // allow-list does not include the sales tools at all.
  const { tool } = createCodeMode({
    id: 'inventory_code',
    tools: { listProducts, getSupplier },
    sandbox: new LocalSandbox(),
  });

  const ctx = () => ({
    observe: { span: async (_n: string, fn: () => any) => fn(), log: () => {} },
  });

  // "Which products are below their reorder point, and what's the supplier lead
  //  time for each?" — one program: list products, filter, batch supplier lookups.
  const program = `
    const { products } = await external_listProducts({});
    const low = products.filter((p) => p.stock < p.reorderPoint);
    const rows = await Promise.all(
      low.map(async (p) => {
        const supplier = await external_getSupplier({ supplierId: p.supplierId });
        return { name: p.name, stock: p.stock, reorderPoint: p.reorderPoint, supplier: supplier.name, leadTimeDays: supplier.leadTimeDays };
      })
    );
    return { needsReorder: rows };
  `;

  const result = await (tool.execute as any)({ code: program }, ctx());
  console.log('\n--- inventory_code result ---\n');
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) {
    throw new Error('Inventory execution failed: ' + JSON.stringify(result.error));
  }

  // Prove the allow-list isolates the two tools: the inventory program cannot
  // reach a sales tool — the function simply isn't defined in its sandbox.
  const leak = await (tool.execute as any)({ code: `return await external_listRecentOrders({ limit: 1 });` }, ctx());
  console.log('\n--- attempting to call a sales tool from inventory_code ---');
  console.log('blocked:', !leak.success, '| error:', leak.error?.message);
  if (leak.success) {
    throw new Error('Allow-list leak: inventory_code reached a sales tool!');
  }
}

async function runAgent() {
  line();
  console.log('Part 3 — full agent run');
  line();

  if (!process.env.OPENAI_API_KEY) {
    console.log('\nSkipping: set OPENAI_API_KEY to run the agent end-to-end.\n');
    return;
  }

  const response = await codeModeAgent.generate(
    'For the 5 most recent orders, list each unique customer with their name, tier, and lifetime value, ' +
      'and tell me the average lifetime value across those customers.',
  );

  console.log('\nAgent response:\n', response.text);
  console.log('\nTools used:', response.toolCalls?.map(tc => tc.name) ?? 'none');
}

async function main() {
  await runDirect();
  await runInventorySubset();
  await runAgent();
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
