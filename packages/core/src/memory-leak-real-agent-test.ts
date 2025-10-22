/**
 * Real Agent Stream OOM Test for Issue #6322
 *
 * This uses actual agent.stream() calls to reproduce the production OOM.
 * Requires OPENAI_API_KEY environment variable.
 *
 * Run with: NODE_OPTIONS="--max-old-space-size=256" tsx src/memory-leak-real-agent-test.ts
 */

import { Agent } from './agent';

// Track memory usage
function logMemory(label: string) {
  const used = process.memoryUsage();
  const heapMB = Math.round(used.heapUsed / 1024 / 1024);
  const totalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  console.log(`[${label}] Heap: ${heapMB}MB / ${totalMB}MB | RSS: ${rssMB}MB`);
  return heapMB;
}

async function testRealAgentStream() {
  console.log('=== Real Agent Stream OOM Test ===');
  console.log('Testing different scenarios to reproduce OOM\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable required');
    process.exit(1);
  }

  const agent = new Agent({
    name: 'test-agent',
    model: 'openai/gpt-4o-mini',
    instructions: 'You are a helpful assistant. Provide very detailed, comprehensive responses with lots of context.',
  });

  let iteration = 0;

  // Test configurations to try
  const scenarios = [
    {
      name: 'Low memory (128MB) + 100 streams',
      memoryLimit: 128,
      iterations: 100,
      contextSize: 50000,
      noDelay: true,
      concurrent: false,
    },
    {
      name: 'Very low memory (64MB) + 50 streams',
      memoryLimit: 64,
      iterations: 50,
      contextSize: 50000,
      noDelay: true,
      concurrent: false,
    },
    {
      name: '256MB + 200 streams + no delay',
      memoryLimit: 256,
      iterations: 200,
      contextSize: 80000,
      noDelay: true,
      concurrent: false,
    },
    {
      name: '256MB + concurrent streams (5 at a time)',
      memoryLimit: 256,
      iterations: 50,
      contextSize: 50000,
      noDelay: true,
      concurrent: true,
      concurrency: 5,
    },
  ];

  // Test different scenarios - try concurrent streams which stress memory more
  const scenario = scenarios[3]; // Concurrent streams
  if (!scenario) {
    console.error('No scenario found');
    process.exit(1);
  }

  console.log(`Testing: ${scenario.name}\n`);
  console.log(`NOTE: You need to restart with NODE_OPTIONS="--max-old-space-size=${scenario.memoryLimit}"\n`);

  try {
    logMemory('Initial');

    if (scenario.concurrent) {
      // Test concurrent streams
      for (let batch = 0; batch < Math.ceil(scenario.iterations / scenario.concurrency!); batch++) {
        const promises = [];
        for (let i = 0; i < scenario.concurrency! && batch * scenario.concurrency! + i < scenario.iterations; i++) {
          iteration = batch * scenario.concurrency! + i + 1;

          const largeContext = 'x'.repeat(scenario.contextSize);
          const prompt = `Please analyze this data: ${largeContext}`;

          promises.push(
            agent.stream(prompt).then(async stream => {
              let totalText = '';
              for await (const chunk of stream.textStream) {
                totalText += chunk;
              }
              return totalText.length;
            }),
          );
        }

        await Promise.all(promises);

        if ((batch + 1) % 2 === 0) {
          const heapMB = logMemory(`After ${(batch + 1) * scenario.concurrency!} streams (concurrent)`);
          if (heapMB > scenario.memoryLimit * 0.8) {
            console.warn(`⚠️  WARNING: Approaching memory limit! Heap: ${heapMB}MB / ${scenario.memoryLimit}MB`);
          }
        }
      }
    } else {
      // Test sequential streams
      for (let i = 0; i < scenario.iterations; i++) {
        iteration = i + 1;

        const largeContext = 'x'.repeat(scenario.contextSize);
        const prompt = `Please analyze this data and provide a detailed summary: ${largeContext}`;

        const stream = await agent.stream(prompt);

        let totalText = '';
        for await (const chunk of stream.textStream) {
          totalText += chunk;
        }

        if ((i + 1) % 10 === 0) {
          const heapMB = logMemory(`After ${i + 1} streams`);

          if (heapMB > scenario.memoryLimit * 0.8) {
            console.warn(`⚠️  WARNING: Approaching memory limit! Heap: ${heapMB}MB / ${scenario.memoryLimit}MB`);
          }
        }

        // Only delay if specified
        if (!scenario.noDelay) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    console.log('\n✅ Test completed without OOM!');
    console.log(`Scenario "${scenario.name}" did not trigger OOM`);
    console.log('Try adjusting parameters or running with lower memory limit.');
    logMemory('Final');
  } catch (error: any) {
    console.error(`\n❌ OOM at iteration ${iteration}!`);
    console.error(`Error: ${error.message}`);
    logMemory('At OOM');

    if (error.message?.includes('heap out of memory') || error.code === 'ERR_OUT_OF_MEMORY') {
      console.log('\n🎯 SUCCESS: OOM reproduced with real agent streams!');
      console.log('Now we can test if the fix prevents this.');
      process.exit(0); // Exit successfully - we WANT the OOM
    }

    process.exit(1);
  }
}

testRealAgentStream().catch(err => {
  console.error('\nTest error:', err.message);
  process.exit(1);
});
