import type { MastraModelConfig } from '../llm';

export const GUARDRAIL_POLICY_BRAND: unique symbol = Symbol.for('mastra.guardrails.policy') as never;

export type GuardrailAction = 'block' | 'warn' | 'redact' | 'rewrite' | 'filter';
export type GuardrailPhase = 'input' | 'output';
export type GuardrailGroupName = 'security' | 'privacy' | 'content' | 'cost';
export type GuardrailSensitivity = 'low' | 'medium' | 'high';
export type GuardrailStreamCheckEvery = 'chunk' | 'sentence' | 'section';
export type GuardrailStreamLookback = 'none' | 'short' | 'medium' | 'long';

export interface GuardrailStreamingOptions {
  checkEvery?: GuardrailStreamCheckEvery;
  lookback?: GuardrailStreamLookback;
}

export type GuardrailViolationHandler = (violation: {
  policyName?: string;
  group?: GuardrailGroupName;
  phase?: GuardrailPhase;
  check: string;
  action: GuardrailAction;
  processorId?: string;
  message: string;
  detail?: unknown;
}) => void | Promise<void>;

export interface BaseGuardrailCheckOptions {
  enabled?: boolean;
  action?: GuardrailAction;
  model?: MastraModelConfig;
  providerOptions?: Record<string, unknown>;
  threshold?: number;
  instructions?: string;
  applyTo?: GuardrailPhase | GuardrailPhase[];
  onViolation?: GuardrailViolationHandler;
}

export interface PromptInjectionGuardrailOptions extends BaseGuardrailCheckOptions {
  applyTo?: never;
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'filter' | 'rewrite'>;
  sensitivity?: GuardrailSensitivity;
  detectionTypes?: Array<'injection' | 'jailbreak' | 'data-exfiltration' | 'system-override' | 'role-manipulation'>;
  includeScores?: boolean;
}

export interface ModerationGuardrailOptions extends BaseGuardrailCheckOptions {
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'filter'>;
  sensitivity?: GuardrailSensitivity;
  categories?: string[];
  includeScores?: boolean;
  chunkWindow?: number;
}

export interface PIIGuardrailOptions extends BaseGuardrailCheckOptions {
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'filter' | 'redact'>;
  sensitivity?: GuardrailSensitivity;
  detectionTypes?: Array<
    | 'email'
    | 'phone'
    | 'credit-card'
    | 'ssn'
    | 'api-key'
    | 'ip-address'
    | 'name'
    | 'address'
    | 'date-of-birth'
    | 'url'
    | 'uuid'
    | 'crypto-wallet'
    | 'iban'
  >;
  redactionMethod?: 'mask' | 'hash' | 'remove' | 'placeholder';
  includeDetections?: boolean;
  preserveFormat?: boolean;
  bufferSize?: number;
}

export interface SystemPromptLeakGuardrailOptions extends BaseGuardrailCheckOptions {
  applyTo?: never;
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'redact' | 'filter'>;
  patterns?: string[];
}

export interface RegexGuardrailOptions {
  enabled?: boolean;
  name?: string;
  pattern?: RegExp | string;
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'redact' | 'filter'>;
  replacement?: string;
  applyTo?: GuardrailPhase | GuardrailPhase[];
  onViolation?: GuardrailViolationHandler;
}

export interface TokenLimitGuardrailOptions {
  enabled?: boolean;
  limit: number;
  action?: Extract<GuardrailAction, 'block'>;
  encoding?: string;
  onViolation?: GuardrailViolationHandler;
}

export interface SecurityGuardrailGroup {
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'rewrite'>;
  model?: MastraModelConfig;
  sensitivity?: GuardrailSensitivity;
  promptInjection?: boolean | PromptInjectionGuardrailOptions;
  systemPromptLeak?: boolean | SystemPromptLeakGuardrailOptions;
}

export interface PrivacyGuardrailGroup {
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'redact' | 'filter'>;
  model?: MastraModelConfig;
  sensitivity?: GuardrailSensitivity;
  pii?: boolean | PIIGuardrailOptions;
  secrets?: boolean | RegexGuardrailOptions;
}

export interface ContentGuardrailGroup {
  action?: Extract<GuardrailAction, 'block' | 'warn' | 'filter'>;
  model?: MastraModelConfig;
  sensitivity?: GuardrailSensitivity;
  moderation?: boolean | ModerationGuardrailOptions;
}

export interface CostGuardrailGroup {
  maxCost?: number;
  tokenLimit?: number | TokenLimitGuardrailOptions;
  scope?: 'run' | 'resource' | 'thread';
  window?: '1h' | '6h' | '24h' | '7d' | '30d' | '365d';
  action?: Extract<GuardrailAction, 'block' | 'warn'>;
  onViolation?: GuardrailViolationHandler;
}

export interface GuardrailPolicyDefinition {
  name?: string;
  model?: MastraModelConfig;
  providerOptions?: Record<string, unknown>;
  sensitivity?: GuardrailSensitivity;
  streaming?: GuardrailStreamingOptions;
  action?: GuardrailAction;
  onViolation?: GuardrailViolationHandler;
  security?: boolean | SecurityGuardrailGroup;
  privacy?: boolean | PrivacyGuardrailGroup;
  content?: boolean | ContentGuardrailGroup;
  cost?: CostGuardrailGroup;
}

export interface GuardrailPolicy extends GuardrailPolicyDefinition {
  readonly [GUARDRAIL_POLICY_BRAND]: true;
}

export type GuardrailsConfig = boolean | GuardrailPolicy | GuardrailPolicy[] | GuardrailPolicyDefinition;
