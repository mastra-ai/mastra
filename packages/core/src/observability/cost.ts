/**
 * Cost Calculation Utilities for LLM Usage
 *
 * Provides pricing data and cost calculation for various LLM providers and models.
 * Prices are in USD per 1M tokens (input/output).
 */

import type { TokenUsage, CostBreakdown } from './metrics';

// ============================================================================
// Pricing Data
// ============================================================================

/**
 * Pricing per 1M tokens (input, output) in USD
 * Last updated: January 2025
 *
 * Note: Prices change frequently. These are approximate and should be
 * updated regularly or fetched from a pricing API in production.
 */
export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  inputPer1M: number;
  /** Cost per 1M output tokens in USD */
  outputPer1M: number;
  /** Cost per 1M cached input tokens (if different) */
  cachedInputPer1M?: number;
}

/**
 * Known model pricing data
 * Format: provider/model -> pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4 family
  'openai/gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
  'openai/gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'openai/gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30 },
  'openai/gpt-4': { inputPer1M: 30, outputPer1M: 60 },
  'openai/gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },

  // OpenAI o1 family (reasoning models)
  'openai/o1': { inputPer1M: 15, outputPer1M: 60 },
  'openai/o1-mini': { inputPer1M: 3, outputPer1M: 12 },
  'openai/o1-preview': { inputPer1M: 15, outputPer1M: 60 },
  'openai/o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },

  // Anthropic Claude family
  'anthropic/claude-3-5-sonnet-20241022': { inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3 },
  'anthropic/claude-3-5-sonnet-latest': { inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3 },
  'anthropic/claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4, cachedInputPer1M: 0.08 },
  'anthropic/claude-3-opus-20240229': { inputPer1M: 15, outputPer1M: 75, cachedInputPer1M: 1.5 },
  'anthropic/claude-3-sonnet-20240229': { inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3 },
  'anthropic/claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25, cachedInputPer1M: 0.03 },

  // Google Gemini family
  'google/gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'google/gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5 },
  'google/gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
  'google/gemini-1.5-flash-8b': { inputPer1M: 0.0375, outputPer1M: 0.15 },

  // Mistral family
  'mistral/mistral-large-latest': { inputPer1M: 2, outputPer1M: 6 },
  'mistral/mistral-small-latest': { inputPer1M: 0.2, outputPer1M: 0.6 },
  'mistral/codestral-latest': { inputPer1M: 0.3, outputPer1M: 0.9 },
  'mistral/ministral-8b-latest': { inputPer1M: 0.1, outputPer1M: 0.1 },
  'mistral/ministral-3b-latest': { inputPer1M: 0.04, outputPer1M: 0.04 },

  // Groq (inference pricing varies)
  'groq/llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'groq/llama-3.1-8b-instant': { inputPer1M: 0.05, outputPer1M: 0.08 },
  'groq/mixtral-8x7b-32768': { inputPer1M: 0.24, outputPer1M: 0.24 },

  // Together AI
  'together/meta-llama/Llama-3.3-70B-Instruct-Turbo': { inputPer1M: 0.88, outputPer1M: 0.88 },
  'together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': { inputPer1M: 0.18, outputPer1M: 0.18 },
  'together/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': { inputPer1M: 3.5, outputPer1M: 3.5 },

  // Fireworks AI
  'fireworks/accounts/fireworks/models/llama-v3p3-70b-instruct': { inputPer1M: 0.9, outputPer1M: 0.9 },

  // xAI Grok
  'xai/grok-2': { inputPer1M: 2, outputPer1M: 10 },
  'xai/grok-2-mini': { inputPer1M: 0.3, outputPer1M: 0.5 },

  // DeepSeek
  'deepseek/deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
  'deepseek/deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19 },
};

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * Calculate cost from token usage and model
 */
export function calculateCost(
  usage: TokenUsage,
  model: string,
  provider?: string,
): CostBreakdown | undefined {
  // Try to find pricing with various key formats
  const pricingKeys = [
    model, // Direct model name
    provider ? `${provider}/${model}` : undefined, // provider/model format
    // Try without version suffix (e.g., claude-3-5-sonnet-20241022 -> claude-3-5-sonnet)
    model.replace(/-\d{8}$/, ''),
    provider ? `${provider}/${model.replace(/-\d{8}$/, '')}` : undefined,
  ].filter(Boolean) as string[];

  let pricing: ModelPricing | undefined;
  for (const key of pricingKeys) {
    pricing = MODEL_PRICING[key];
    if (pricing) break;

    // Also try lowercase
    pricing = MODEL_PRICING[key.toLowerCase()];
    if (pricing) break;
  }

  if (!pricing) {
    return undefined; // Unknown model, can't calculate cost
  }

  // Calculate costs
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const cachedTokens = usage.cachedTokens || 0;

  // For cached tokens, use cached price if available, otherwise use input price
  const cachedPrice = pricing.cachedInputPer1M ?? pricing.inputPer1M;

  // Adjust input tokens to exclude cached tokens (they're priced separately)
  const nonCachedInputTokens = Math.max(0, inputTokens - cachedTokens);

  const inputCost = (nonCachedInputTokens / 1_000_000) * pricing.inputPer1M;
  const cachedCost = (cachedTokens / 1_000_000) * cachedPrice;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  const totalCost = inputCost + cachedCost + outputCost;

  return {
    totalCostUSD: totalCost,
    modelCostUSD: totalCost,
    costByModel: {
      [model]: totalCost,
    },
  };
}

/**
 * Aggregate multiple cost breakdowns
 */
export function aggregateCosts(costs: (CostBreakdown | undefined)[]): CostBreakdown {
  const result: CostBreakdown = {
    totalCostUSD: 0,
    modelCostUSD: 0,
    toolCostUSD: 0,
    costByModel: {},
  };

  for (const cost of costs) {
    if (!cost) continue;

    result.totalCostUSD += cost.totalCostUSD;
    result.modelCostUSD = (result.modelCostUSD || 0) + (cost.modelCostUSD || 0);
    result.toolCostUSD = (result.toolCostUSD || 0) + (cost.toolCostUSD || 0);

    if (cost.costByModel) {
      for (const [model, modelCost] of Object.entries(cost.costByModel)) {
        result.costByModel![model] = (result.costByModel![model] || 0) + modelCost;
      }
    }
  }

  return result;
}

/**
 * Format cost as human-readable string
 */
export function formatCost(cost: number): string {
  if (cost < 0.0001) {
    return `$${(cost * 1000000).toFixed(2)}µ`; // Microdollars for tiny costs
  }
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(3)}m`; // Millidollars
  }
  if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Estimate cost for a given token count and model (useful for budgeting)
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  provider?: string,
): number | undefined {
  const cost = calculateCost({ inputTokens, outputTokens }, model, provider);
  return cost?.totalCostUSD;
}

// ============================================================================
// Pricing Registry
// ============================================================================

/**
 * Register custom pricing for a model
 */
export function registerModelPricing(modelKey: string, pricing: ModelPricing): void {
  MODEL_PRICING[modelKey] = pricing;
}

/**
 * Get pricing for a model
 */
export function getModelPricing(model: string, provider?: string): ModelPricing | undefined {
  const keys = [
    model,
    provider ? `${provider}/${model}` : undefined,
  ].filter(Boolean) as string[];

  for (const key of keys) {
    const pricing = MODEL_PRICING[key] || MODEL_PRICING[key.toLowerCase()];
    if (pricing) return pricing;
  }

  return undefined;
}

/**
 * Check if pricing is available for a model
 */
export function hasPricing(model: string, provider?: string): boolean {
  return getModelPricing(model, provider) !== undefined;
}
