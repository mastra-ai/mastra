/**
 * Mastra + Dakera persistent memory example.
 *
 * Prerequisites:
 *   # 1. Start Dakera locally
 *   docker run -d -p 3300:3300 \
 *     -e DAKERA_API_KEY=demo \
 *     ghcr.io/dakera-ai/dakera:latest
 *
 *   # 2. Set env vars
 *   export OPENAI_API_KEY=sk-...
 *   export DAKERA_API_URL=http://localhost:3300
 *   export DAKERA_API_KEY=demo
 *
 *   # 3. Run
 *   npm run dev
 */

import { mastra } from './mastra';

async function main() {
  const agent = mastra.getAgent('memoryAgent');

  // -----------------------------------------------------------------------
  // Session 1: user tells the agent their preferences
  // -----------------------------------------------------------------------
  console.log('\n=== Session 1 ===\n');

  const r1 = await agent.generate(
    "Hi! I'm Alice. I'm a backend engineer who loves Rust and hates verbose Java code. " +
      'I prefer concise, type-safe APIs over fluent builders.',
  );
  console.log('Agent:', r1.text, '\n');

  const r2 = await agent.generate(
    "I'm currently building a distributed key-value store in Rust. " +
      "The hardest part so far is managing the RAFT consensus log — it's getting complex.",
  );
  console.log('Agent:', r2.text, '\n');

  // -----------------------------------------------------------------------
  // Session 2: fresh conversation — agent should recall Alice's context
  // -----------------------------------------------------------------------
  console.log('\n=== Session 2 (new conversation) ===\n');

  const r3 = await agent.generate(
    "Hey, I need some advice on database indexing strategies for high write throughput.",
  );
  console.log('Agent:', r3.text, '\n');

  // The agent should recall that Alice is building a Rust KV store and tailor advice accordingly.
  // Memories survive across Node.js process restarts — run the script twice to see full recall.
}

main().catch(console.error);
