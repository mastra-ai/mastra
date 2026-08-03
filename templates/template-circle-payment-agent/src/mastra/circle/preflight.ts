// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import { chainLabel, type Chain } from './chains';
import type { GatewayDepositMethod } from './gateway';
import { chooseChain, getServiceAccepts, preferredChain, sellerRequiresGateway } from './services';
import { getBalance, isWalletDeployed } from './wallet';

// Checks that run before USDC moves. Each returns its failure as a message rather than throwing,
// so a refusal reaches the model as a readable tool result it can act on.

export type ChainSelection = { ok: true; chain: Chain } | { ok: false; message: string };

export type PreflightCheck = { ok: true } | { ok: false; message: string };

export function parsePayload(
  dataJson: string,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  try {
    return { ok: true, data: JSON.parse(dataJson) as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      message:
        `dataJson is not valid JSON: ${(e as Error).message}. ` +
        'Re-check the service input schema reported by circle-inspect-service.',
    };
  }
}

// Prefers Base, but defers to whichever offered chain the wallet can actually afford.
export async function selectPayChain(url: string, method: string, address: string): Promise<ChainSelection> {
  try {
    const accepts = await getServiceAccepts(url, method);
    const picked = await chooseChain(accepts, address);
    if (!picked) {
      const offered = accepts.unsupportedNetworks.join(', ') || 'none';
      return {
        ok: false,
        message:
          'This service offers no payment option on a chain this agent supports (Base or ' +
          `Polygon). Seller networks: ${offered}.`,
      };
    }
    return { ok: true, chain: picked };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function selectGatewayChain(url: string, method: string): Promise<ChainSelection> {
  try {
    const accepts = await getServiceAccepts(url, method);
    const picked = preferredChain(accepts);
    if (!picked || !sellerRequiresGateway(accepts, picked)) {
      return {
        ok: false,
        message:
          `${url} does not require a Circle Gateway payment on a chain this agent supports, so a ` +
          'Gateway deposit would not help it. It can be paid with circle-pay-service directly.',
      };
    }
    return { ok: true, chain: picked };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// An undeployed Smart Contract Account cannot sign x402 payments, and deployment is per-chain.
export async function ensureDeployed(address: string, chain: Chain): Promise<PreflightCheck> {
  try {
    if (!(await isWalletDeployed({ address, chain }))) {
      return {
        ok: false,
        message:
          `Wallet ${address} is not deployed on-chain on ${chainLabel(chain)} yet, so it cannot ` +
          `sign x402 payments there. circle-deploy-wallet with this address and chain "${chain}" ` +
          'deploys it, after which this payment can go through.',
      };
    }
    return { ok: true };
  } catch {
    // Detection failed on a flaky RPC; do not block a payment that may well work.
    return { ok: true };
  }
}

// A transfer names its own amount, so an underfunded wallet can be caught before the call rather
// than read back as an opaque CLI failure.
export async function ensureUsdcBalance(address: string, chain: Chain, amount: number): Promise<PreflightCheck> {
  try {
    const balance = await getBalance({ address, chain });
    const held = Number(balance.tokens.find(t => t.symbol === 'USDC')?.amount ?? '0');
    if (!Number.isFinite(held) || held >= amount) return { ok: true };
    return {
      ok: false,
      message:
        `Wallet ${address} holds ${held} USDC on ${chainLabel(chain)}, short of the ${amount} USDC ` +
        'this transfer would send. NO USDC WAS SENT. Fund the wallet or lower the amount, then retry.',
    };
  } catch {
    // Balance read failed on a flaky call; do not block a transfer that may well work.
    return { ok: true };
  }
}

// Polygon Gateway sellers get the fast eco method; Base sellers must use direct.
export function selectDepositMethod(chain: Chain): GatewayDepositMethod {
  return chain === 'POLYGON' ? 'eco' : 'direct';
}
