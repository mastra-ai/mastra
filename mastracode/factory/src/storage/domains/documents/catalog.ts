/**
 * The fixed catalog of essential factory documents.
 *
 * A factory project keeps its business-analysis and technical documents as
 * markdown files in the repository under `docs/factory/`, mapped to catalog
 * kinds by `docs/factory/manifest.yaml`. The catalog is the contract every
 * surface shares: the sync reads exactly these kinds from the checkout, the
 * kickoff index lists them for agents, the read tool accepts them, and the
 * Documents page renders one row per kind so a missing document is visible
 * as a gap rather than an absence.
 *
 * v1 hardcodes the folder and the kinds; per-factory configuration is a
 * documented follow-up.
 */

import { z } from 'zod';

export const FACTORY_DOCS_DIR = 'docs/factory';
export const FACTORY_DOCS_MANIFEST = `${FACTORY_DOCS_DIR}/manifest.yaml`;

export type FactoryDocGroup = 'ba' | 'tech';

export interface FactoryDocKindDefinition {
  kind: string;
  group: FactoryDocGroup;
  label: string;
  /** Repo-relative path used when the manifest does not map the kind. */
  defaultPath: string;
  /** One line telling an agent what the document is for. */
  purpose: string;
}

export const FACTORY_DOC_KINDS = [
  {
    kind: 'product-vision',
    group: 'ba',
    label: 'Product vision / PRD',
    defaultPath: `${FACTORY_DOCS_DIR}/product-vision.md`,
    purpose: 'Why the product exists, who it serves, and the outcomes it must deliver.',
  },
  {
    kind: 'personas',
    group: 'ba',
    label: 'Personas',
    defaultPath: `${FACTORY_DOCS_DIR}/personas.md`,
    purpose: 'The user and stakeholder archetypes whose needs drive requirements.',
  },
  {
    kind: 'user-stories',
    group: 'ba',
    label: 'User stories & acceptance criteria',
    defaultPath: `${FACTORY_DOCS_DIR}/user-stories.md`,
    purpose: 'Behaviour the product must exhibit, each with verifiable acceptance criteria.',
  },
  {
    kind: 'business-rules',
    group: 'ba',
    label: 'Business rules',
    defaultPath: `${FACTORY_DOCS_DIR}/business-rules.md`,
    purpose: 'Domain invariants, policies, and calculations the code must enforce.',
  },
  {
    kind: 'glossary',
    group: 'ba',
    label: 'Glossary',
    defaultPath: `${FACTORY_DOCS_DIR}/glossary.md`,
    purpose: 'Canonical names for domain concepts so code, docs, and conversation agree.',
  },
  {
    kind: 'process-flows',
    group: 'ba',
    label: 'Process flows',
    defaultPath: `${FACTORY_DOCS_DIR}/process-flows.md`,
    purpose: 'End-to-end business processes and the states a case moves through.',
  },
  {
    kind: 'architecture',
    group: 'tech',
    label: 'Architecture overview',
    defaultPath: `${FACTORY_DOCS_DIR}/architecture.md`,
    purpose: 'System components, boundaries, and how requests and data flow between them.',
  },
  {
    kind: 'adrs',
    group: 'tech',
    label: 'Architecture decision records',
    defaultPath: `${FACTORY_DOCS_DIR}/adrs.md`,
    purpose: 'Significant technical decisions, the options weighed, and why one won.',
  },
  {
    kind: 'data-model',
    group: 'tech',
    label: 'Data model',
    defaultPath: `${FACTORY_DOCS_DIR}/data-model.md`,
    purpose: 'Entities, relationships, storage schemas, and their lifecycle rules.',
  },
  {
    kind: 'api-spec',
    group: 'tech',
    label: 'API specification',
    defaultPath: `${FACTORY_DOCS_DIR}/api-spec.md`,
    purpose: 'Public and internal interfaces: endpoints, payloads, errors, and versioning.',
  },
  {
    kind: 'coding-standards',
    group: 'tech',
    label: 'Coding standards',
    defaultPath: `${FACTORY_DOCS_DIR}/coding-standards.md`,
    purpose: 'Conventions for structure, naming, error handling, and review expectations.',
  },
  {
    kind: 'testing-strategy',
    group: 'tech',
    label: 'Testing strategy',
    defaultPath: `${FACTORY_DOCS_DIR}/testing-strategy.md`,
    purpose: 'Which layers are tested how, coverage expectations, and how to run the suites.',
  },
  {
    kind: 'runbook',
    group: 'tech',
    label: 'Runbook / deployment',
    defaultPath: `${FACTORY_DOCS_DIR}/runbook.md`,
    purpose: 'How the system is built, deployed, configured, monitored, and recovered.',
  },
  {
    kind: 'security-compliance',
    group: 'tech',
    label: 'Security & compliance',
    defaultPath: `${FACTORY_DOCS_DIR}/security-compliance.md`,
    purpose: 'Threat model, data handling rules, secrets policy, and compliance obligations.',
  },
] as const satisfies readonly FactoryDocKindDefinition[];

export type FactoryDocKind = (typeof FACTORY_DOC_KINDS)[number]['kind'];

const KIND_IDS = FACTORY_DOC_KINDS.map(definition => definition.kind) as [FactoryDocKind, ...FactoryDocKind[]];

export const factoryDocKindSchema = z.enum(KIND_IDS);

const DEFINITIONS_BY_KIND: ReadonlyMap<string, FactoryDocKindDefinition> = new Map(
  FACTORY_DOC_KINDS.map(definition => [definition.kind, definition]),
);

export function isFactoryDocKind(value: string): value is FactoryDocKind {
  return DEFINITIONS_BY_KIND.has(value);
}

export function factoryDocKindDefinition(kind: FactoryDocKind): FactoryDocKindDefinition {
  const definition = DEFINITIONS_BY_KIND.get(kind);
  if (!definition) throw new Error(`Unknown factory document kind: ${kind}`);
  return definition;
}
