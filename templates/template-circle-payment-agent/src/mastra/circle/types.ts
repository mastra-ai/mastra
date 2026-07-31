// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Chain } from './chains';

export interface AgentWallet {
  address: string;
}

export interface TokenBalance {
  symbol: string;
  amount: string;
}

export interface WalletBalance {
  address: string;
  tokens: TokenBalance[];
}

export interface Service {
  url: string;
  name: string;
  description?: string;
  price?: string;
  chain?: Chain;
  method?: string;
}

export interface ServiceInspection extends Service {
  schema?: unknown;
  health?: 'payable' | 'healthy' | 'degraded' | 'down' | string;
  // Status the marketplace last saw. 402 is a healthy paid resource; 5xx means paying buys an error.
  httpStatus?: number;
  priceUsdc?: number;
  method?: string;
  openApiUrl?: string;
  docsUrl?: string;
}

export interface PaymentResult {
  response: string;
  // Best-effort: a successful payment may omit it, so success is decided by the CLI exit code.
  txHash?: string;
  serviceUrl: string;
  amount: string;
}

export interface GatewayBalance {
  address: string;
  total: string;
}

export interface GatewayDepositResult {
  amount: string;
  txId?: string;
  method?: 'direct' | 'eco';
}

export interface FetchServiceResult {
  url: string;
  status: number;
  paymentRequired: boolean;
  contentType?: string;
  body: string;
}

export type AcceptKind = 'vanilla' | 'gateway';

export interface AcceptOption {
  kind: AcceptKind;
  chain: Chain;
  // Price in atomic USDC units (6 decimals).
  amountAtomic: string;
}

export interface ServiceAccepts {
  url: string;
  options: AcceptOption[];
  unsupportedNetworks: string[];
}
