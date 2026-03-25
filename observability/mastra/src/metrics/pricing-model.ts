import type { UsageStats } from '@mastra/core/observability';
import type { PricingMeter, PricingConditionOperator, PricingConditionField } from './types';

export class PricingTier {
  readonly index: number;
  readonly when?: Array<{ field: PricingConditionField; op: PricingConditionOperator; value: number }>;
  readonly rates: Partial<Record<PricingMeter, number>>;

  constructor(args: {
    index: number;
    when?: Array<{ field: PricingConditionField; op: PricingConditionOperator; value: number }>;
    rates: Partial<Record<PricingMeter, number>>;
  }) {
    this.index = args.index;
    this.when = args.when;
    this.rates = args.rates;
  }

  matchesUsage(usage: UsageStats): boolean {
    if (!this.when || this.when.length === 0) {
      return true;
    }

    return this.when.every(condition => this.matchesCondition(condition, usage));
  }

  hasMatchingMeterForUsage(meter: PricingMeter): boolean {
    return Boolean(meter && typeof this.rates[meter] === 'number');
  }

  private matchesCondition(
    condition: { field: PricingConditionField; op: PricingConditionOperator; value: number },
    usage: UsageStats,
  ): boolean {
    const left = this.getConditionFieldValue(condition.field, usage);
    if (left == null) {
      return false;
    }

    switch (condition.op) {
      case 'gt':
        return left > condition.value;
      case 'gte':
        return left >= condition.value;
      case 'lt':
        return left < condition.value;
      case 'lte':
        return left <= condition.value;
      case 'eq':
        return left === condition.value;
      case 'neq':
        return left !== condition.value;
      default:
        return false;
    }
  }

  private getConditionFieldValue(field: PricingConditionField, usage: UsageStats): number | null {
    switch (field) {
      case 'total_input_tokens':
        return typeof usage.inputTokens === 'number' ? usage.inputTokens : null;
      default:
        return null;
    }
  }
}

export class PricingModel {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly schema: string;
  readonly currency: string;
  readonly tiers: PricingTier[];

  constructor(args: {
    id: string;
    provider: string;
    model: string;
    schema: string;
    currency: string;
    tiers: PricingTier[];
  }) {
    this.id = args.id;
    this.provider = args.provider;
    this.model = args.model;
    this.schema = args.schema;
    this.currency = args.currency;
    this.tiers = args.tiers;
  }

  getPricingTierForUsage(usage: UsageStats): PricingTier | null {
    for (const tier of this.tiers) {
      if (tier.when && tier.when.length > 0 && tier.matchesUsage(usage)) {
        return tier;
      }
    }

    return this.getBasePricingTier();
  }

  getBasePricingTier(): PricingTier | null {
    return this.tiers[0] ?? null;
  }
}
