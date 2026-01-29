import { Provider } from '@mastra/client-js';

/**
 * Model information with provider context
 */
export interface ModelInfo {
  /** Provider ID (e.g., 'openai', 'anthropic.messages') */
  provider: string;
  /** Provider display name */
  providerName: string;
  /** Model ID (e.g., 'gpt-4', 'claude-3-opus') */
  model: string;
}

/**
 * Selected model value for picker components
 */
export interface SelectedModel {
  provider: string;
  modelId: string;
}

/**
 * Props for provider picker options
 */
export interface ProviderOption {
  label: string;
  value: string;
  provider: Provider;
}

/**
 * Props for model picker options
 */
export interface ModelOption {
  label: string;
  value: string;
  model: ModelInfo;
}

/**
 * Layout variants for the combined provider/model picker
 */
export type PickerLayout = 'horizontal' | 'vertical' | 'compact';

/**
 * Warning display variants
 */
export type WarningVariant = 'alert' | 'inline';

/**
 * Common variant types matching the Combobox design system
 */
export type ComboboxVariant = 'default' | 'light' | 'outline' | 'ghost';

/**
 * Size variants for picker components
 */
export type PickerSize = 'sm' | 'md' | 'lg';
