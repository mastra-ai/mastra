// Third-party MCP boundary fixture. The production MCP client, provider,
// workflow, locks and LibSQL storage all run unchanged in the caller.
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const statePath = process.env.QUICKBOOKS_TOKEN_STORE_PATH;
const read = () => JSON.parse(readFileSync(statePath, 'utf8'));
const content = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const tools = ['search_vendors', 'search_purchase_orders', 'get_purchase_order', 'search_bills', 'create-bill'];
const inputSchema = {
  type: 'object',
  properties: { params: { type: 'object', additionalProperties: true } },
  required: ['params'],
};
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  const state = read();
  let result;
  if (message.method === 'initialize') {
    result = {
      protocolVersion: message.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'qbo-boundary-fixture', version: '1' },
    };
  } else if (message.method === 'tools/list') {
    result = {
      tools: tools
        .filter(
          name =>
            name !== state.missingTool && (name !== 'create-bill' || process.env.QUICKBOOKS_DISABLE_WRITE !== 'true'),
        )
        .map(name => ({ name, description: name, inputSchema })),
    };
  } else if (message.method === 'tools/call') {
    const { name, arguments: args } = message.params;
    state.calls.push({ name, args, writeDisabled: process.env.QUICKBOOKS_DISABLE_WRITE });
    if (state.errorTool === name) {
      result = { isError: true, content: [{ type: 'text', text: 'QuickBooks unavailable for fixture scenario' }] };
    } else if (name === 'search_vendors') {
      result = content(state.vendors.filter(vendor => vendor.DisplayName === args.params.criteria[0].value));
    } else if (name === 'search_purchase_orders') {
      const { txn_date_from: from, txn_date_to: to, limit = 1000, vendor_ref: vendor } = args.params;
      result = content(
        state.orders
          .filter(
            order =>
              (!from || order.TxnDate >= from) &&
              (!to || order.TxnDate <= to) &&
              (!vendor || order.VendorRef.value === vendor),
          )
          .slice(0, limit),
      );
    } else if (name === 'get_purchase_order') {
      result = {
        content: [
          { type: 'text', text: 'Purchase order found:' },
          { type: 'text', text: JSON.stringify(state.orders.find(order => order.Id === args.params.id) ?? {}) },
        ],
      };
    } else if (name === 'search_bills') {
      const number = args.params.criteria?.find(item => item.field === 'DocNumber')?.value;
      result = content(state.bills.filter(bill => !number || bill.DocNumber === number));
    } else if (name === 'create-bill' && process.env.QUICKBOOKS_DISABLE_WRITE !== 'true') {
      const bill = { ...args.params.bill, Id: `bill-${state.bills.length + 1}` };
      // Observed against the official Intuit sandbox: a header-only PO link
      // is discarded unless a bill line also identifies its PO TxnLineId.
      const lineLinks = bill.Line.flatMap(line => line.LinkedTxn ?? []);
      bill.LinkedTxn = (bill.LinkedTxn ?? []).filter(link =>
        lineLinks.some(lineLink => lineLink.TxnId === link.TxnId && lineLink.TxnLineId),
      );
      state.bills.push(bill);
      result = content(bill);
    } else {
      result = { isError: true, content: [{ type: 'text', text: 'Tool unavailable' }] };
    }
    writeFileSync(statePath, JSON.stringify(state));
  } else if (message.method === 'ping') {
    result = {};
  } else {
    process.stdout.write(
      JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }) + '\n',
    );
    return;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
});
lines.on('close', () => process.exit(0));
