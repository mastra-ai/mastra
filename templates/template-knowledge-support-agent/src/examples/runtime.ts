import { fileURLToPath } from 'node:url';
import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { exampleProfiles, exampleReviewers, exampleStudioRole, retailProfiles } from './retail-pos/profiles.ts';
import type { Profile } from '../mastra/identity.ts';
import type { DatasetConfiguration } from '../mastra/knowledge/seed-manifest.ts';

export const integrationProfiles: Profile[] = [
  { id: 'integration-team', actorId: 'morgan', tenantId: 'software', customerId: 'example-app' },
  { id: 'integration-colleague', actorId: 'taylor', tenantId: 'software', customerId: 'example-app' },
];
export const integrationReviewers: Profile[] = [
  { id: 'integration-reviewer', actorId: 'jamie', tenantId: 'software', customerId: 'example-app' },
];
export const helpdeskProfiles: Profile[] = [
  { id: 'helpdesk-office', actorId: 'ana', tenantId: 'helpdesk', customerId: 'office' },
  { id: 'helpdesk-branch', actorId: 'bruno', tenantId: 'helpdesk', customerId: 'branch' },
  { id: 'helpdesk-colleague', actorId: 'clara', tenantId: 'helpdesk', customerId: 'office' },
];
export const helpdeskReviewers: Profile[] = [
  { id: 'helpdesk-reviewer', actorId: 'davi', tenantId: 'helpdesk', customerId: 'office' },
  { id: 'helpdesk-branch-reviewer', actorId: 'elisa', tenantId: 'helpdesk', customerId: 'branch' },
];

export interface RuntimeExample {
  id: string;
  initialDataset: string;
  profiles: Profile[];
  reviewers: Profile[];
  role: string;
  locale: string;
  model: `${string}/${string}`;
  policy: { kind: 'tenant'; path: string; pageKey: string };
  optionalListing: { list: string; depth: 1 };
  customerRoots: string[];
  sharedRoot: string;
  topicTerms: Record<string, string[]>;
  instructions: string;
  datasets: DatasetConfiguration[];
}
const directory = (name: string) => fileURLToPath(new URL(`../../knowledge-datasets/${name}/`, import.meta.url));
const defaults = {
  role: exampleStudioRole,
  locale: 'en-US',
  model: 'openai/gpt-4o-mini' as const,
  policy: { kind: 'tenant' as const, path: 'policies/safe-changes', pageKey: 'safety-policy' },
  optionalListing: { list: 'docs:$tenantId#guides', depth: 1 as const },
  customerRoots: ['cases'],
  sharedRoot: 'learnings',
};
function policies(profiles: Profile[], entries: [string, string][], path = defaults.policy.path) {
  return entries.map(([profileId, pageKey]) => {
    const profile = profiles.find(profile => profile.id === profileId);
    if (!profile) throw new Error(`Unknown dataset profile: ${profileId}`);
    return { profileId, pageKey, ref: `${knowledgeScopeAddress('tenant:$tenantId', { ...profile })}#${path}` };
  });
}

/** Trusted process configuration selects a use case; requests and models cannot select it. */
export const examples: Record<string, RuntimeExample> = {
  'retail-pos': {
    ...defaults,
    id: 'retail-pos',
    initialDataset: 'retail-pos-docs',
    profiles: [...exampleProfiles, ...retailProfiles],
    reviewers: exampleReviewers,
    topicTerms: {
      connectivity: ['connectivity', 'connection', 'network', 'wifi', 'wi-fi', 'offline', 'cable'],
      payments: ['payment', 'payments', 'pending', 'offline'],
      printing: ['printer', 'printing', 'receipt', 'ethernet', 'bluetooth', 'usb'],
    },
    instructions:
      'Help technicians troubleshoot Retail POS and Square Terminal connectivity, payments, and printers. Advise only; never operate hardware or handle payment data. Ask whether payments are pending and which connection indicator is visible when those facts are missing.',
    datasets: [
      {
        id: 'retail-pos',
        directory: directory('retail-pos'),
        profiles: exampleProfiles,
        mandatoryPolicies: policies(exampleProfiles, [['north-store', 'safety-policy']]),
      },
      {
        id: 'retail-pos-docs',
        directory: directory('retail-pos'),
        manifestFile: 'docs-manifest.json',
        profiles: retailProfiles,
        mandatoryPolicies: policies(retailProfiles, [
          ['retailops-store-42', 'safety-policy-0'],
          ['fieldretail-store-42', 'safety-policy-2'],
        ]),
      },
      {
        id: 'retail-pos-history',
        directory: directory('retail-pos'),
        manifestFile: 'history-manifest.json',
        profiles: retailProfiles,
        mandatoryPolicies: [],
      },
    ],
  },
  'software-integration': {
    ...defaults,
    id: 'software-integration',
    initialDataset: 'software-integration',
    profiles: integrationProfiles,
    reviewers: integrationReviewers,
    topicTerms: { requests: ['request', 'requests', '401', 'unauthorized', 'authentication', 'credentials', 'http'] },
    instructions:
      'Help developers diagnose HTTP integration authentication failures using the public HTTP reference and fictional case evidence. Ask for the response status and authentication challenge scheme without requesting credentials. Advise only; never send requests or rotate credentials. Distinguish a 401 response from an observed confirmed resolution.',
    datasets: [
      {
        id: 'software-integration',
        directory: directory('software-integration'),
        profiles: integrationProfiles,
        mandatoryPolicies: policies(integrationProfiles, [['integration-team', 'change-policy']]),
      },
    ],
  },
  'it-helpdesk': {
    ...defaults,
    id: 'it-helpdesk',
    initialDataset: 'it-helpdesk',
    locale: 'pt-BR',
    policy: { kind: 'tenant', path: 'policies/helpdesk-safety', pageKey: 'helpdesk-policy' },
    profiles: helpdeskProfiles,
    reviewers: helpdeskReviewers,
    topicTerms: {
      connectivity: ['conectividade', 'conexão', 'conexões', 'configuração', 'rede', 'adaptador', 'tcp', 'ipconfig'],
    },
    instructions:
      'Atenda em português do Brasil. Ajude a equipe de TI a investigar conectividade do Windows usando a referência pública e o histórico autorizado. Pergunte qual adaptador está ativo e quais sintomas foram observados. ipconfig /all exibe a configuração TCP/IP; isso não comprova conectividade nem uma solução. Oriente apenas; não execute comandos, não altere a rede e não solicite saídas completas com identificadores privados. Separe observações confirmadas de hipóteses.',
    datasets: [
      {
        id: 'it-helpdesk',
        directory: directory('it-helpdesk'),
        profiles: helpdeskProfiles,
        mandatoryPolicies: policies(
          helpdeskProfiles,
          [['helpdesk-office', 'helpdesk-policy']],
          'policies/helpdesk-safety',
        ),
      },
    ],
  },
};
export function selectExample(name = process.env.SUPPORT_EXAMPLE ?? 'retail-pos'): RuntimeExample {
  const example = examples[name];
  if (!example) throw new Error(`Choose SUPPORT_EXAMPLE ${Object.keys(examples).join(', ')}`);
  return example;
}
export function selectProfile(example: RuntimeExample, id: string): Profile {
  const profile = [...example.profiles, ...example.reviewers].find(profile => profile.id === id);
  if (!profile) throw new Error(`Unknown profile ${id} for ${example.id}`);
  return profile;
}
export const runtimeExample = selectExample();

/** Both agents share the configured model and the same wire-level test override. */
export function configuredModel() {
  return process.env.SUPPORT_MODEL_BASE_URL
    ? {
        id: runtimeExample.model,
        api: 'chat' as const,
        url: process.env.SUPPORT_MODEL_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
      }
    : runtimeExample.model;
}
