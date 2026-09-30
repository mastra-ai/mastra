import { providerDisplayName } from '../settings/components/provider-display-name';

export type PersonaId = 'shane' | 'damien' | 'ward' | 'grayson';
export type Actor = PersonaId | 'factory';
export type Provider = string;

export type PlanUsage = { kind: 'window'; percent: number } | { kind: 'spend'; spent: number; budget: number };

export type Plan = {
  provider: Provider;
  kind: 'subscription' | 'api-key';
  label: string;
  model: string;
  /** Expired login or revoked key: the session pauses rather than switching payer. */
  disconnected?: boolean;
  usage?: PlanUsage;
};

export type Persona = { id: PersonaId; name: string; initials: string };

export const PERSONAS: Record<PersonaId, Persona> = {
  shane: { id: 'shane', name: 'Shane', initials: 'ST' },
  damien: { id: 'damien', name: 'Damien', initials: 'DS' },
  ward: { id: 'ward', name: 'Ward', initials: 'WP' },
  grayson: { id: 'grayson', name: 'Grayson', initials: 'GH' },
};

export const PERSONA_IDS: PersonaId[] = ['shane', 'damien', 'ward', 'grayson'];

export const PLANS = {
  claudeMax: {
    provider: 'anthropic',
    kind: 'subscription',
    label: 'Claude Max',
    model: 'Opus 5.5',
    usage: { kind: 'window', percent: 71 },
  },
  chatgptPro: {
    provider: 'openai',
    kind: 'subscription',
    label: 'ChatGPT Pro',
    model: 'GPT-5',
    usage: { kind: 'window', percent: 38 },
  },
  personalAnthropicKey: {
    provider: 'anthropic',
    kind: 'api-key',
    label: 'personal API key',
    model: 'Sonnet 5.5',
    usage: { kind: 'spend', spent: 42, budget: 100 },
  },
  companyAnthropicKey: {
    provider: 'anthropic',
    kind: 'api-key',
    label: 'Company Anthropic key',
    model: 'Sonnet 5.5',
    usage: { kind: 'spend', spent: 1240, budget: 3000 },
  },
  companyOpenAIKey: {
    provider: 'openai',
    kind: 'api-key',
    label: 'Company OpenAI key',
    model: 'GPT-5',
    usage: { kind: 'spend', spent: 310, budget: 1000 },
  },
  companyDeepSeekKey: {
    provider: 'deepseek',
    kind: 'api-key',
    label: 'Company DeepSeek key',
    model: 'DeepSeek V4',
    usage: { kind: 'spend', spent: 18, budget: 200 },
  },
} satisfies Record<string, Plan>;

const COMPANY_KEYS: Record<Provider, Plan> = {
  anthropic: PLANS.companyAnthropicKey,
  openai: PLANS.companyOpenAIKey,
  deepseek: PLANS.companyDeepSeekKey,
};

const SUBSCRIPTIONS: Record<Provider, Plan> = {
  anthropic: PLANS.claudeMax,
  openai: PLANS.chatgptPro,
};

export function companyKeyFor(provider: Provider): Plan {
  const name = providerDisplayName(provider);
  return (
    COMPANY_KEYS[provider] ?? { provider, kind: 'api-key', label: `Company ${name} key`, model: `${name} default` }
  );
}

export function subscriptionFor(provider: Provider): Plan {
  const name = providerDisplayName(provider);
  return SUBSCRIPTIONS[provider] ?? { provider, kind: 'subscription', label: `${name} plan`, model: `${name} default` };
}

export const PROVIDERS: Provider[] = ['anthropic', 'openai', 'deepseek'];

const MODEL_PROVIDERS: Record<string, Provider> = {
  'Opus 5.5': 'anthropic',
  'Sonnet 5.5': 'anthropic',
  'Haiku 4.5': 'anthropic',
  'GPT-5': 'openai',
  'GPT-5 mini': 'openai',
  'DeepSeek V4': 'deepseek',
};

export const MODEL_OPTIONS = Object.keys(MODEL_PROVIDERS);

export function providerOf(model: string): Provider | undefined {
  return MODEL_PROVIDERS[model];
}

export function modelsFrom(provider: Provider): string[] {
  return MODEL_OPTIONS.filter(model => MODEL_PROVIDERS[model] === provider);
}

export function modelsOn(plan: Plan): string[] {
  const models = modelsFrom(plan.provider);
  return models.includes(plan.model) ? models : [plan.model, ...models];
}

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' },
];

export function actorName(actor: Actor): string {
  return actor === 'factory' ? 'Factory' : PERSONAS[actor].name;
}

export function possessive(actor: Actor): string {
  return actor === 'factory' ? "the Factory's" : `${PERSONAS[actor].name}'s`;
}
