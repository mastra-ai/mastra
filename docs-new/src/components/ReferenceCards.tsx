import React from 'react';
import { CardGrid, CardGridItem } from './CardGrid';

const referenceItems = [
  {
    title: 'Core',
    description: 'Core Mastra functionality and APIs',
    href: '/docs/reference/core',
  },
  {
    title: 'Agents',
    description: 'Agent configuration and methods',
    href: '/docs/reference/agents',
  },
  {
    title: 'Workflows',
    description: 'Workflow engine and step definitions',
    href: '/docs/reference/workflows',
  },
  {
    title: 'Tools',
    description: 'Tool creation and management',
    href: '/docs/reference/tools',
  },
  {
    title: 'Memory',
    description: 'Memory system and storage',
    href: '/docs/reference/memory',
  },
  {
    title: 'RAG',
    description: 'Retrieval Augmented Generation',
    href: '/docs/reference/rag',
  },
  {
    title: 'Evals',
    description: 'Evaluation framework',
    href: '/docs/reference/evals',
  },
  {
    title: 'Scorers',
    description: 'Scoring functions for evaluations',
    href: '/docs/reference/scorers',
  },
  {
    title: 'Storage',
    description: 'Storage adapters and interfaces',
    href: '/docs/reference/storage',
  },
  {
    title: 'Vectors',
    description: 'Vector database integrations',
    href: '/docs/reference/vectors',
  },
  {
    title: 'Auth',
    description: 'Authentication and authorization',
    href: '/docs/reference/auth',
  },
  {
    title: 'Voice',
    description: 'Voice synthesis and recognition',
    href: '/docs/reference/voice',
  },
  {
    title: 'Streaming',
    description: 'Streaming API responses',
    href: '/docs/reference/streaming',
  },
  {
    title: 'CLI',
    description: 'Command-line interface',
    href: '/docs/reference/cli',
  },
  {
    title: 'Deployer',
    description: 'Deployment utilities',
    href: '/docs/reference/deployer',
  },
  {
    title: 'Client JS',
    description: 'JavaScript client SDK',
    href: '/docs/reference/client-js',
  },
  {
    title: 'Observability',
    description: 'Monitoring and telemetry',
    href: '/docs/reference/observability',
  },
  {
    title: 'Processors',
    description: 'Data processors',
    href: '/docs/reference/processors',
  },
  {
    title: 'Templates',
    description: 'Project templates',
    href: '/docs/reference/templates',
  },
  {
    title: 'Legacy Workflows',
    description: 'Legacy workflow system',
    href: '/docs/reference/legacyWorkflows',
  },
];

export function ReferenceCards() {
  return (
    <CardGrid>
      {referenceItems.map((item) => (
        <CardGridItem
          key={item.href}
          title={item.title}
          description={item.description}
          href={item.href}
        />
      ))}
    </CardGrid>
  );
}
