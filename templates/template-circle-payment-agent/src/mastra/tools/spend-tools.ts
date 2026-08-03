import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { requireSession } from '../circle/auth';
import { chainLabel, CHAIN_VALUES, DEFAULT_CHAIN } from '../circle/chains';
import { gatewayDeposit } from '../circle/gateway';
import {
  ensureDeployed,
  ensureUsdcBalance,
  parsePayload,
  selectDepositMethod,
  selectGatewayChain,
  selectPayChain,
} from '../circle/preflight';
import { payService } from '../circle/services';
import { transferUsdc } from '../circle/wallet';
import { ADDRESS_DESCRIPTION, CHAIN_DESCRIPTION, SERVICE_URL_DESCRIPTION } from './circle-tools';

// The three tools that move USDC. All carry `requireApproval`, so Mastra suspends the run before
// `execute` is entered and Studio shows the pending call for the user to approve or decline.
//
// For the two service-bound tools the chain is not the model's to choose: each reads the seller's
// published x402 options and settles on one this agent supports, so a hallucinated chain cannot
// send a payment somewhere the seller does not accept. A plain transfer has no seller to read, so
// there the chain is an argument — and one the approval prompt shows before anything moves.

const HTTP_METHOD_VALUES = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
const methodEnum = z.enum(HTTP_METHOD_VALUES);
const chainEnum = z.enum(CHAIN_VALUES);

const METHOD_DESCRIPTION =
  'HTTP method the service expects. A GET service reads the payload as URL query parameters; ' +
  'POST, PUT and PATCH read it as a JSON request body. Defaults to GET.';

// A JSON string rather than an object: an open payload object collapses to a closed, propertyless
// `{}` under the strict tool schemas these SDKs generate, so the model could never fill it and
// every paid call would send an empty body.
const DATA_JSON_DESCRIPTION =
  'JSON-encoded payload object matching the service input schema, e.g. \'{"city":"NYC"}\'. ' +
  'Every input the service takes belongs here, whatever its HTTP method — do not append ' +
  'parameters to the URL instead. Fields naming a path parameter are substituted into the URL ' +
  'path, and the rest travel as query parameters on a GET or as a JSON body on POST, PUT and ' +
  'PATCH. Pass "{}" when the service takes no input.';

export const circlePayServiceTool = createTool({
  id: 'circle-pay-service',
  description:
    'Pay for an x402 service with a Circle USDC payment and return the response bought. Settles ' +
    'on Base or Polygon, picked from the payment options the seller publishes and the wallet ' +
    'balance on each, and pays under whichever scheme the seller requires — vanilla x402 or ' +
    'Circle Gateway. Spends real USDC and requires the user to approve the call first.',
  inputSchema: z.object({
    url: z.string().describe(SERVICE_URL_DESCRIPTION),
    address: z.string().describe(ADDRESS_DESCRIPTION),
    method: methodEnum.optional().describe(METHOD_DESCRIPTION),
    dataJson: z.string().describe(DATA_JSON_DESCRIPTION),
  }),
  outputSchema: z.object({
    response: z.string().describe('The response body that was paid for.'),
    txHash: z.string().optional().describe('Settlement hash, when one can be parsed from the receipt.'),
    serviceUrl: z.string(),
    amount: z.string().describe('USDC amount charged.'),
    chain: chainEnum.describe('Chain the payment settled on.'),
    chainLabel: z.string(),
  }),
  requireApproval: true,
  execute: async ({ url, address, method, dataJson }) => {
    await requireSession();

    const httpMethod = (method ?? 'GET').toUpperCase();
    const payload = parsePayload(dataJson);
    if (!payload.ok) throw new Error(payload.message);

    const chain = await selectPayChain(url, httpMethod, address);
    if (!chain.ok) throw new Error(chain.message);

    const deployed = await ensureDeployed(address, chain.chain);
    if (!deployed.ok) throw new Error(deployed.message);

    const result = await payService({
      url,
      address,
      data: payload.data,
      method: httpMethod,
      chain: chain.chain,
    });
    return { ...result, chain: chain.chain, chainLabel: chainLabel(chain.chain) };
  },
});

export const circleGatewayDepositTool = createTool({
  id: 'circle-gateway-deposit',
  description:
    "Move USDC into the wallet's Circle Gateway balance, the pool a seller draws from when it " +
    "requires Gateway (batched) x402 payments. The chain comes from the service's published " +
    'Gateway options, Base preferred and Polygon otherwise, and the deposit method follows from ' +
    "it: Polygon uses eco (~30s, sourced from the wallet's Base USDC), Base uses direct (13-19 " +
    'min, consumes gas on Base). Spends the deposit amount plus a fee, and requires the user to ' +
    'approve the call first.',
  inputSchema: z.object({
    url: z.string().describe(SERVICE_URL_DESCRIPTION),
    address: z.string().describe(ADDRESS_DESCRIPTION),
    method: methodEnum.optional().describe(METHOD_DESCRIPTION),
    amount: z
      .number()
      .positive()
      .describe(
        'USDC amount to move into Gateway. A Gateway minimum deposit may apply, and a fee of ' +
          'about $0.03 is charged on top.',
      ),
  }),
  outputSchema: z.object({
    amount: z.string(),
    txId: z.string().optional(),
    method: z.enum(['direct', 'eco']).optional().describe('The method actually used, which may be a downgrade.'),
    chain: chainEnum.describe('Chain the deposit settled on.'),
    chainLabel: z.string(),
  }),
  requireApproval: true,
  execute: async ({ url, address, method, amount }) => {
    await requireSession();

    const httpMethod = (method ?? 'GET').toUpperCase();
    const chain = await selectGatewayChain(url, httpMethod);
    if (!chain.ok) throw new Error(chain.message);

    const depositMethod = selectDepositMethod(chain.chain);
    const result = await gatewayDeposit({
      address,
      amount,
      chain: chain.chain,
      method: depositMethod,
    });
    return { ...result, chain: chain.chain, chainLabel: chainLabel(chain.chain) };
  },
});

export const circleTransferUsdcTool = createTool({
  id: 'circle-transfer-usdc',
  description:
    "Send USDC from one of this agent's wallets to any address. Settles on a single chain and " +
    'does not bridge: the recipient must control `to` on the chosen chain, and USDC sent to an ' +
    'address that does not exist there is gone. Unlike circle-pay-service this buys nothing and ' +
    'has no seller to verify the destination against, so the address comes from the user. Spends ' +
    'real USDC and requires the user to approve the call first.',
  inputSchema: z.object({
    address: z.string().describe(ADDRESS_DESCRIPTION),
    to: z
      .string()
      .describe(
        'Destination address (0x-prefixed, 40 hex characters), exactly as the user gave it. Never ' +
          'guess or complete a partial address.',
      ),
    amount: z.number().positive().describe('USDC amount to send, in whole units (e.g. 2.5 for $2.50).'),
    chain: chainEnum.optional().describe(CHAIN_DESCRIPTION),
  }),
  outputSchema: z.object({
    from: z.string(),
    to: z.string(),
    amount: z.string().describe('USDC amount sent.'),
    chain: chainEnum,
    chainLabel: z.string(),
    txId: z.string().optional().describe('Circle transaction id, or an on-chain hash when one is returned.'),
  }),
  requireApproval: true,
  execute: async ({ address, to, amount, chain }) => {
    await requireSession();

    const target = chain ?? DEFAULT_CHAIN;
    const funded = await ensureUsdcBalance(address, target, amount);
    if (!funded.ok) throw new Error(funded.message);

    const result = await transferUsdc({ address, to, amount, chain: target });
    return { ...result, chainLabel: chainLabel(target) };
  },
});

export const circleSpendTools = {
  'circle-pay-service': circlePayServiceTool,
  'circle-gateway-deposit': circleGatewayDepositTool,
  'circle-transfer-usdc': circleTransferUsdcTool,
};
