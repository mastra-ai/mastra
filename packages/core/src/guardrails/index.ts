import { GUARDRAIL_POLICY_BRAND } from './types';
import type {
  ContentGuardrailGroup,
  CostGuardrailGroup,
  GuardrailPolicy,
  GuardrailPolicyDefinition,
  PrivacyGuardrailGroup,
  SecurityGuardrailGroup,
} from './types';

export * from './compile';
export * from './evaluate';
export * from './types';

function brandPolicy(config: GuardrailPolicyDefinition): GuardrailPolicy {
  return Object.defineProperty({ ...config }, GUARDRAIL_POLICY_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  }) as GuardrailPolicy;
}

export function defineGuardrailPolicy(config: GuardrailPolicyDefinition): GuardrailPolicy {
  return brandPolicy(config);
}

export function defineSecurityPolicy(config: boolean | SecurityGuardrailGroup = true): GuardrailPolicy {
  return brandPolicy({ security: config });
}

export function definePrivacyPolicy(config: boolean | PrivacyGuardrailGroup = true): GuardrailPolicy {
  return brandPolicy({ privacy: config });
}

export function defineContentPolicy(config: boolean | ContentGuardrailGroup = true): GuardrailPolicy {
  return brandPolicy({ content: config });
}

export function defineCostPolicy(config: CostGuardrailGroup): GuardrailPolicy {
  return brandPolicy({ cost: config });
}

export function isGuardrailPolicy(value: unknown): value is GuardrailPolicy {
  return Boolean(value && typeof value === 'object' && (value as GuardrailPolicy)[GUARDRAIL_POLICY_BRAND]);
}
