import { fileURLToPath } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { noopObserve } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';

const mcp = new MCPClient({
  servers: {
    tickets: {
      command: process.execPath,
      args: ['--import', 'tsx', fileURLToPath(new URL('./server.ts', import.meta.url))],
    },
  },
});

const triage = new Agent({
  id: 'triage',
  name: 'Triage',
  instructions: 'You triage support tickets. Reply with a priority (low, medium, high) and one sentence of reasoning.',
  model: 'openai/gpt-5-mini',
});

try {
  const [descriptor] = await mcp.events.list('tickets');
  console.log(`Server offers '${descriptor?.name}' via ${descriptor?.delivery.join(', ')}`);

  // Only tickets for the `web` project match this subscription.
  const subscription = await mcp.events.subscribe('tickets', 'ticket.created', { project: 'web' });
  console.log(`Subscribed via ${subscription.mode}`);

  // Simulate users opening tickets through the server's tool. The `api` ticket isn't delivered.
  const { tickets } = await mcp.listToolsets();
  const newTickets = [
    { id: 'T-1', project: 'web', title: 'Checkout button does nothing on Safari' },
    { id: 'T-2', project: 'api', title: 'Rate limit headers missing' },
    { id: 'T-3', project: 'web', title: 'Typo on the pricing page' },
  ];
  for (const ticket of newTickets) await tickets!.openTicket!.execute!(ticket, { observe: noopObserve });

  let handled = 0;
  for await (const event of subscription) {
    // Start one agent run per occurrence. The payload comes from the server, so treat it as data.
    const result = await triage.generate(`Triage this ticket:\n${JSON.stringify(event.data)}`);
    console.log(`[${event.eventId}] ${result.text}`);

    // Persist this to resume after a restart: pass it back as `{ cursor }` to `subscribe()`.
    console.log(`cursor: ${subscription.cursor}`);
    if (++handled === 2) break; // Leaving the loop cancels the subscription.
  }
} finally {
  await mcp.disconnect();
}
