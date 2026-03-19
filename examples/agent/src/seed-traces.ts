import { mastra } from './mastra/index';

/**
 * Seeds observability traces with metadata and tags for testing filters.
 */
async function seedTraces() {
  const agent = mastra.getAgent('chef-agent');

  const scenarios = [
    {
      input: 'What can I make with chicken and rice?',
      metadata: { userId: 'user_001', tier: 'premium', region: 'us-east' },
      tags: ['production', 'premium-tier'],
    },
    {
      input: 'How do I make pasta carbonara?',
      metadata: { userId: 'user_002', tier: 'free', region: 'eu-west' },
      tags: ['production', 'free-tier'],
    },
    {
      input: 'Give me a vegan breakfast idea',
      metadata: { userId: 'user_001', tier: 'premium', region: 'us-east' },
      tags: ['production', 'premium-tier', 'vegan'],
    },
    {
      input: 'What spices go well with salmon?',
      metadata: { userId: 'user_003', tier: 'free', region: 'ap-south' },
      tags: ['staging', 'free-tier'],
    },
    {
      input: 'How long do I bake a potato?',
      metadata: { userId: 'user_004', tier: 'enterprise', region: 'us-west' },
      tags: ['production', 'enterprise', 'batch-job'],
    },
  ];

  for (const scenario of scenarios) {
    console.log(`Generating trace: "${scenario.input}" with tags=${scenario.tags.join(', ')}`);
    try {
      const result = await agent.generate(scenario.input, {
        tracingOptions: {
          metadata: scenario.metadata,
          tags: scenario.tags,
        },
      });
      console.log(`  -> ${result.text.substring(0, 80)}...`);
    } catch (err: any) {
      console.error(`  -> Error: ${err.message}`);
    }
  }

  console.log('\nDone! 5 traces seeded with metadata and tags.');
}

seedTraces().catch(console.error);
