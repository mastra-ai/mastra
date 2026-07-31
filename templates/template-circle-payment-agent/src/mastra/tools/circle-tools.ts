import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { logout, requireSession } from '../circle/auth';
import { CHAIN_VALUES } from '../circle/chains';
import { gatewayBalance } from '../circle/gateway';
import { fetchService, inspectService, searchServices } from '../circle/services';
import {
  fetchSetupSkill,
  fetchSubSkill,
  SETUP_SKILL_URL,
  SUB_SKILL_CATALOG,
  SUB_SKILL_NAMES,
  type SubSkillName,
} from '../circle/skill';
import { createWallet, deployWallet, fundWallet, fundWalletFiat, getBalance, listWallets } from '../circle/wallet';

// Every tool that does not move USDC. The two that do live in `spend-tools.ts`, behind
// `requireApproval`. Descriptions say what each tool does and what its arguments mean, and nothing
// about when to call it: that guidance belongs to the marketplace skill the agent fetches.

const chainEnum = z.enum(CHAIN_VALUES);
const subSkillEnum = z.enum(SUB_SKILL_NAMES as [SubSkillName, ...SubSkillName[]]);

export const ADDRESS_DESCRIPTION = 'Agent wallet address (0x-prefixed, from circle-list-wallets).';
export const CHAIN_DESCRIPTION = 'Chain to act on, BASE or POLYGON. Defaults to BASE.';
export const SERVICE_URL_DESCRIPTION = 'The service URL, exactly as the marketplace publishes it.';

const serviceSchema = z.object({
  url: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.string().optional(),
  chain: chainEnum.optional(),
  method: z.string().optional(),
});

export const fetchSetupSkillTool = createTool({
  id: 'fetch-setup-skill',
  description: `Fetch the Circle Agent setup skill from ${SETUP_SKILL_URL}. Equivalent to "curl -sL ${SETUP_SKILL_URL}". Returns its raw markdown.`,
  inputSchema: z.object({}),
  outputSchema: z.string().describe('The setup skill markdown.'),
  execute: async () => fetchSetupSkill(),
});

export const fetchSubSkillTool = createTool({
  id: 'fetch-sub-skill',
  description: `Fetch a Circle Agent sub-skill markdown by name. Available sub-skills:\n${SUB_SKILL_CATALOG}`,
  inputSchema: z.object({
    name: subSkillEnum.describe('Sub-skill name, without the .md extension.'),
  }),
  outputSchema: z.string().describe('The sub-skill markdown.'),
  execute: async ({ name }) => fetchSubSkill(name),
});

export const circleSessionStatusTool = createTool({
  id: 'circle-session-status',
  description:
    'Check whether the Circle CLI has a valid agent session on this host. Returns { valid: true } ' +
    'or throws with the exact command the user must run in their own terminal. Login and Terms of ' +
    "Use acceptance are the user's to perform, never the agent's.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    valid: z.literal(true).describe('True when a valid agent session exists on this host.'),
  }),
  execute: async () => {
    await requireSession();
    return { valid: true as const };
  },
});

export const circleLogoutTool = createTool({
  id: 'circle-logout',
  description:
    'Log out of the Circle agent wallet and clear its stored credentials. Safe to call when no ' +
    'session exists, in which case it reports that nothing was logged out.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    loggedOut: z.boolean().describe('False when there was no session to clear.'),
    message: z.string(),
  }),
  execute: async () => logout(),
});

export const circleListWalletsTool = createTool({
  id: 'circle-list-wallets',
  description: 'List existing Circle agent wallets on Base. Returns an array of { address }.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    wallets: z.array(z.object({ address: z.string() })),
  }),
  execute: async () => {
    await requireSession();
    return { wallets: await listWallets() };
  },
});

export const circleCreateWalletTool = createTool({
  id: 'circle-create-wallet',
  description: 'Create a new Circle agent wallet on Base. Returns { address }.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    address: z.string().describe('The new wallet address.'),
  }),
  execute: async () => {
    await requireSession();
    return createWallet();
  },
});

export const circleGetBalanceTool = createTool({
  id: 'circle-get-balance',
  description: 'Read the USDC and token balances held by a wallet address on a chain. Defaults to Base.',
  inputSchema: z.object({
    address: z.string().describe(ADDRESS_DESCRIPTION),
    chain: chainEnum.optional().describe(CHAIN_DESCRIPTION),
  }),
  outputSchema: z.object({
    address: z.string(),
    tokens: z.array(z.object({ symbol: z.string(), amount: z.string() })),
  }),
  execute: async ({ address, chain }) => {
    await requireSession();
    return getBalance({ address, chain });
  },
});

export const circleDeployWalletTool = createTool({
  id: 'circle-deploy-wallet',
  description:
    "Deploy an agent wallet's Smart Contract Account on-chain via a one-time, zero-value " +
    'self-transfer. A newly created wallet is counterfactual: it can receive USDC but cannot sign ' +
    'x402 payments until deployed, and deployment is per-chain. Idempotent and gas-abstracted: it ' +
    'spends nothing, and on an already-deployed wallet it sends no transaction.',
  inputSchema: z.object({
    address: z.string().describe(ADDRESS_DESCRIPTION),
    chain: chainEnum.optional().describe(CHAIN_DESCRIPTION),
  }),
  outputSchema: z.object({
    address: z.string(),
    deployed: z.boolean().describe('True once the contract is confirmed on-chain.'),
    alreadyDeployed: z.boolean().describe('True when no transaction was needed.'),
    txId: z.string().optional(),
  }),
  execute: async ({ address, chain }) => {
    await requireSession();
    return deployWallet({ address, chain });
  },
});

export const circleWalletFundTool = createTool({
  id: 'circle-wallet-fund',
  description:
    'Fund an agent wallet with testnet USDC on Base. method="crypto" draws from the testnet ' +
    'faucet; method="fiat" runs the test card flow.',
  inputSchema: z.object({
    address: z.string().describe(ADDRESS_DESCRIPTION),
    method: z
      .enum(['crypto', 'fiat'])
      .default('crypto')
      .describe('"crypto" draws from the testnet faucet; "fiat" runs the test card flow.'),
  }),
  outputSchema: z.object({
    output: z.string().describe('Raw CLI output, whose shape differs by funding method.'),
  }),
  execute: async ({ address, method }) => {
    await requireSession();
    return { output: await fundWallet({ address, method }) };
  },
});

export const circleFundFiatTool = createTool({
  id: 'circle-fund-fiat',
  description:
    'Generate a Transak on-ramp URL for buying tokens with fiat (card or bank). Returns a `url` ' +
    'the user opens to complete the purchase, after which the tokens deposit into the wallet on ' +
    'the chosen chain. This tool only builds the URL and moves no USDC itself. Mainnet only.',
  inputSchema: z.object({
    address: z.string().describe(ADDRESS_DESCRIPTION),
    amount: z.number().positive().describe('Amount of the token to buy, in whole units (e.g. 10 for $10 of USDC).'),
    chain: chainEnum.optional().describe(CHAIN_DESCRIPTION),
    token: z.enum(['usdc', 'eurc', 'eth', 'native']).optional().describe('Token to buy. Defaults to usdc.'),
  }),
  outputSchema: z.object({
    address: z.string(),
    chain: chainEnum,
    amount: z.string(),
    token: z.enum(['usdc', 'eurc', 'eth', 'native']),
    url: z.string().describe('The on-ramp URL to hand the user. Generating it moves no money.'),
  }),
  execute: async ({ address, amount, chain, token }) => {
    await requireSession();
    return fundWalletFiat({ address, amount, chain, token });
  },
});

export const circleSearchServicesTool = createTool({
  id: 'circle-search-services',
  description: 'Search the Circle Agent Marketplace for x402-compatible services matching a keyword.',
  inputSchema: z.object({
    keyword: z.string().describe('Search keyword.'),
  }),
  outputSchema: z.object({
    services: z.array(serviceSchema),
  }),
  execute: async ({ keyword }) => {
    await requireSession();
    return { services: await searchServices({ keyword }) };
  },
});

export const circleInspectServiceTool = createTool({
  id: 'circle-inspect-service',
  description: 'Inspect an x402 service. Returns its price, input schema, HTTP method, and health.',
  inputSchema: z.object({
    url: z.string().describe(SERVICE_URL_DESCRIPTION),
  }),
  outputSchema: serviceSchema.extend({
    schema: z.unknown().optional().describe('The published input schema.'),
    health: z.string().optional(),
    httpStatus: z.number().optional().describe('402 is a healthy paid resource; 5xx means paying buys an error.'),
    priceUsdc: z.number().optional().describe('Price in whole USDC.'),
    openApiUrl: z.string().optional(),
    docsUrl: z.string().optional(),
  }),
  execute: async ({ url }) => {
    await requireSession();
    return inspectService({ url });
  },
});

export const fetchServiceTool = createTool({
  id: 'fetch-service',
  description:
    'GET a service endpoint without paying. Returns the response status and body, plus ' +
    '`paymentRequired`, which is true when the endpoint answered HTTP 402 rather than serving ' +
    'its data for free.',
  inputSchema: z.object({
    url: z.string().describe(SERVICE_URL_DESCRIPTION),
  }),
  outputSchema: z.object({
    url: z.string(),
    status: z.number(),
    paymentRequired: z.boolean().describe('True when the endpoint answered HTTP 402.'),
    contentType: z.string().optional(),
    body: z.string(),
  }),
  execute: async ({ url }) => fetchService({ url }),
});

export const circleGetGatewayBalanceTool = createTool({
  id: 'circle-get-gateway-balance',
  description:
    "Read the wallet's Circle Gateway balance on a chain: the off-chain batched-payment pool, " +
    'which is separate from the on-chain balance reported by circle-get-balance. Defaults to Base.',
  inputSchema: z.object({
    address: z.string().describe(ADDRESS_DESCRIPTION),
    chain: chainEnum.optional().describe(CHAIN_DESCRIPTION),
  }),
  outputSchema: z.object({
    address: z.string(),
    total: z.string().describe('Total USDC held in the Gateway balance.'),
  }),
  execute: async ({ address, chain }) => {
    await requireSession();
    return gatewayBalance({ address, chain });
  },
});

export const circleReadTools = {
  'fetch-setup-skill': fetchSetupSkillTool,
  'fetch-sub-skill': fetchSubSkillTool,
  'circle-session-status': circleSessionStatusTool,
  'circle-logout': circleLogoutTool,
  'circle-list-wallets': circleListWalletsTool,
  'circle-create-wallet': circleCreateWalletTool,
  'circle-get-balance': circleGetBalanceTool,
  'circle-deploy-wallet': circleDeployWalletTool,
  'circle-wallet-fund': circleWalletFundTool,
  'circle-fund-fiat': circleFundFiatTool,
  'circle-search-services': circleSearchServicesTool,
  'circle-inspect-service': circleInspectServiceTool,
  'fetch-service': fetchServiceTool,
  'circle-get-gateway-balance': circleGetGatewayBalanceTool,
};
