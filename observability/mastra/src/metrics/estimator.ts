import type { CostContext, UsageStats } from '@mastra/core/observability';
import type { PricingTier, PricingModel } from './pricing-model';
import { PricingRegistry } from './pricing-registry';
import { TokenMetrics, PricingMeter } from './types';
import { getTokenMetricSamples } from './usage-metrics';

export function estimateCosts(
  args: {
    provider: string;
    model: string;
    usage: UsageStats;
  },
  pricingRegistry: PricingRegistry | null = PricingRegistry.getGlobal(),
): Map<TokenMetrics, CostContext> {
  const { provider, model, usage } = args;
  const results = new Map<TokenMetrics, CostContext>();

  const pricingModel = pricingRegistry?.get({ provider, model });
  if (!pricingModel) {
    const errorContext: CostContext = { costMetadata: { error: 'no_matching_model' }, provider, model };
    applyErrorContextForUsage(results, usage, errorContext);
    return results;
  }
  const costMetadata: Record<string, unknown> = { pricing_id: pricingModel.id };

  const pricingTier = pricingModel.getPricingTierForUsage(usage);
  if (!pricingTier) {
    const errorContext: CostContext = { costMetadata: { ...costMetadata, error: 'no_matching_tier' }, provider, model };
    applyErrorContextForUsage(results, usage, errorContext);
    return results;
  }
  costMetadata['tier_index'] = pricingTier.index;

  const estimateFields = {
    pricingModel,
    pricingTier,
    costMetadata,
  };

  const inputDetailResults: Array<{ success: boolean; costContext: CostContext }> = [];
  if (usage.inputDetails?.audio) {
    const result = estimateCostForMeter({
      meter: PricingMeter.INPUT_AUDIO_TOKENS,
      tokenCount: usage.inputDetails.audio,
      ...estimateFields,
    });
    results.set(TokenMetrics.INPUT_AUDIO, result.costContext);
    inputDetailResults.push(result);
  }

  if (usage.inputDetails?.cacheRead) {
    const result = estimateCostForMeter({
      meter: PricingMeter.INPUT_CACHE_READ_TOKENS,
      tokenCount: usage.inputDetails.cacheRead,
      ...estimateFields,
    });
    results.set(TokenMetrics.INPUT_CACHE_READ, result.costContext);
    inputDetailResults.push(result);
  }

  if (usage.inputDetails?.cacheWrite) {
    const result = estimateCostForMeter({
      meter: PricingMeter.INPUT_CACHE_WRITE_TOKENS,
      tokenCount: usage.inputDetails.cacheWrite,
      ...estimateFields,
    });
    results.set(TokenMetrics.INPUT_CACHE_WRITE, result.costContext);
    inputDetailResults.push(result);
  }

  if (usage.inputDetails?.image) {
    const result = estimateCostForMeter({
      meter: PricingMeter.INPUT_IMAGE_TOKENS,
      tokenCount: usage.inputDetails.image,
      ...estimateFields,
    });
    results.set(TokenMetrics.INPUT_IMAGE, result.costContext);
    inputDetailResults.push(result);
  }

  if (usage.inputDetails?.text) {
    const result = estimateCostForMeter({
      meter: PricingMeter.INPUT_TOKENS,
      tokenCount: usage.inputDetails.text,
      ...estimateFields,
    });
    results.set(TokenMetrics.INPUT_TEXT, result.costContext);
    inputDetailResults.push(result);
  }

  setAggregateCostContext({
    results,
    totalMetric: TokenMetrics.TOTAL_INPUT,
    fallbackMeter: PricingMeter.INPUT_TOKENS,
    totalTokenCount: usage.inputTokens,
    detailResults: inputDetailResults,
    ...estimateFields,
  });

  const outputDetailResults: Array<{ success: boolean; costContext: CostContext }> = [];
  if (usage.outputDetails?.audio) {
    const result = estimateCostForMeter({
      meter: PricingMeter.OUTPUT_AUDIO_TOKENS,
      tokenCount: usage.outputDetails.audio,
      ...estimateFields,
    });
    results.set(TokenMetrics.OUTPUT_AUDIO, result.costContext);
    outputDetailResults.push(result);
  }

  if (usage.outputDetails?.image) {
    const result = estimateCostForMeter({
      meter: PricingMeter.OUTPUT_IMAGE_TOKENS,
      tokenCount: usage.outputDetails.image,
      ...estimateFields,
    });
    results.set(TokenMetrics.OUTPUT_IMAGE, result.costContext);
    outputDetailResults.push(result);
  }

  if (usage.outputDetails?.reasoning) {
    const result = estimateCostForMeter({
      meter: PricingMeter.OUTPUT_REASONING_TOKENS,
      tokenCount: usage.outputDetails.reasoning,
      ...estimateFields,
    });
    results.set(TokenMetrics.OUTPUT_REASONING, result.costContext);
    outputDetailResults.push(result);
  }

  if (usage.outputDetails?.text) {
    const result = estimateCostForMeter({
      meter: PricingMeter.OUTPUT_TOKENS,
      tokenCount: usage.outputDetails.text,
      ...estimateFields,
    });
    results.set(TokenMetrics.OUTPUT_TEXT, result.costContext);
    outputDetailResults.push(result);
  }

  setAggregateCostContext({
    results,
    totalMetric: TokenMetrics.TOTAL_OUTPUT,
    fallbackMeter: PricingMeter.OUTPUT_TOKENS,
    totalTokenCount: usage.outputTokens,
    detailResults: outputDetailResults,
    ...estimateFields,
  });

  return results;
}

function applyErrorContextForUsage(
  results: Map<TokenMetrics, CostContext>,
  usage: UsageStats,
  errorContext: CostContext,
): void {
  for (const sample of getTokenMetricSamples(usage)) {
    results.set(sample.name, errorContext);
  }
}

function setAggregateCostContext(args: {
  results: Map<TokenMetrics, CostContext>;
  totalMetric: TokenMetrics;
  fallbackMeter: PricingMeter;
  totalTokenCount: number | undefined;
  detailResults: Array<{ success: boolean; costContext: CostContext }>;
  pricingModel: PricingModel;
  pricingTier: PricingTier;
  costMetadata: Record<string, unknown>;
}): void {
  const {
    results,
    totalMetric,
    fallbackMeter,
    totalTokenCount,
    detailResults,
    pricingModel,
    pricingTier,
    costMetadata,
  } = args;
  if (totalTokenCount == null) {
    return;
  }

  const successfulDetailCosts = detailResults
    .filter(result => result.success)
    .map(result => result.costContext.estimatedCost)
    .filter((value): value is number => typeof value === 'number');

  if (successfulDetailCosts.length > 0) {
    const hasFailedDetailCost = detailResults.some(result => !result.success);
    results.set(totalMetric, {
      provider: pricingModel.provider,
      model: pricingModel.model,
      estimatedCost: successfulDetailCosts.reduce((sum, value) => sum + value, 0),
      costUnit: pricingModel.currency,
      costMetadata: hasFailedDetailCost ? { ...costMetadata, error: 'partial_cost' } : { ...costMetadata },
    });
    return;
  }

  const fallbackResult = estimateCostForMeter({
    meter: fallbackMeter,
    tokenCount: totalTokenCount,
    pricingModel,
    pricingTier,
    costMetadata,
  });
  results.set(totalMetric, fallbackResult.costContext);
}

function estimateCostForMeter(args: {
  pricingModel: PricingModel;
  pricingTier: PricingTier;
  meter: PricingMeter;
  tokenCount: number;
  costMetadata: Record<string, unknown>;
}): {
  success: boolean;
  costContext: CostContext;
} {
  const { pricingModel, pricingTier, meter, tokenCount, costMetadata } = args;
  const costContext: CostContext = {
    provider: pricingModel.provider,
    model: pricingModel.model,
  };
  const pricePerUnit = pricingTier.rates[meter];
  if (typeof pricePerUnit !== 'number') {
    return {
      success: false,
      costContext: {
        ...costContext,
        costMetadata: { ...costMetadata, error: 'no_pricing_for_usage_type' },
      },
    };
  }

  return {
    success: true,
    costContext: {
      ...costContext,
      estimatedCost: tokenCount * pricePerUnit,
      costUnit: pricingModel.currency,
      costMetadata: { ...costMetadata },
    },
  };
}
