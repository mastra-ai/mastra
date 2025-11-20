// Define your models here.

export interface Model {
  id: string;
  label: string;
  provider: 'OPEN_AI';
  apiIdentifier: string;
  description: string;
}

export const models: Array<Model> = [
  {
    id: 'gpt-5.1',
    label: 'GPT 4o mini',
    provider: 'OPEN_AI',
    apiIdentifier: 'gpt-5.1',
    description: 'Small model for fast, lightweight tasks',
  },
  {
    id: 'gpt-5.1',
    label: 'GPT 4o',
    provider: 'OPEN_AI',
    apiIdentifier: 'gpt-5.1',
    description: 'For complex, multi-step tasks',
  },
] as const;

export const DEFAULT_MODEL_NAME: string = 'gpt-5.1';
