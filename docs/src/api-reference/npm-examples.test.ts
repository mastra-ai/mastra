import { expect, it } from 'vitest'
import { compileComment } from './comments'
import { prepareExamples } from './npm-examples'
import type { ApiSurface } from './presentation'

it('uses the existing npm-to-yarn transform without executing source MDX', async () => {
  const examples = [
    compileComment([{ kind: 'code', text: '```bash npm2yarn\nnpm install @mastra/core\n```' }], new Map()),
  ]
  const surfaces: ApiSurface[] = [
    {
      id: 'example',
      title: 'Example',
      section: 'signatures',
      entries: [
        { id: 'entry', name: 'Entry', optional: false, description: [], deprecated: [], defaults: [], examples },
      ],
    },
  ]
  await prepareExamples(surfaces)
  expect(examples[0]).toEqual([
    {
      kind: 'tabs',
      items: [
        {
          value: 'npm',
          label: 'npm',
          content: [{ kind: 'code', language: 'bash', value: 'npm install @mastra/core' }],
        },
        { value: 'pnpm', label: 'pnpm', content: [{ kind: 'code', language: 'bash', value: 'pnpm add @mastra/core' }] },
        { value: 'yarn', label: 'Yarn', content: [{ kind: 'code', language: 'bash', value: 'yarn add @mastra/core' }] },
        { value: 'bun', label: 'Bun', content: [{ kind: 'code', language: 'bash', value: 'bun add @mastra/core' }] },
      ],
    },
  ])
})
