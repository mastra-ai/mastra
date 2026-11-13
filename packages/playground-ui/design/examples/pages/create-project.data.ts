import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';

export const exampleModels: ComboboxOption[] = [
  { value: 'balanced', label: 'Balanced model', description: 'Good default for most agents.' },
  { value: 'fast', label: 'Fast model', description: 'Lowest latency. Best for routing and short replies.' },
];

export const exampleSizes: ComboboxOption[] = [
  { value: 'serverless', label: 'Serverless', description: 'Sleeps when idle and wakes on the next request.' },
  { value: 'small', label: 'Small', description: 'Always on. Fits most agents.' },
  { value: 'large', label: 'Large', description: 'Always on, with room for heavy workflows.' },
];
