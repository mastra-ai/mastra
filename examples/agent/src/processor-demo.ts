/**
 * Processor Features Demo
 *
 * This script demonstrates how to use processors with agents:
 *
 * 1. Agent with individual processors - using agent.generate() and agent.stream()
 * 2. Agent with processor workflow - chaining processors in a workflow
 * 3. Handling tripwires - detecting when processors block content
 * 4. TripWire metadata - accessing detailed info about why content was blocked
 *
 * Run with: pnpm processor-demo
 */

import {
  moderatedAssistantAgent,
  agentWithProcessorWorkflow,
  simpleAssistantAgent,
} from './mastra/workflows/content-moderation.js';

async function main() {
  console.log('🚀 Processor Features Demo\n');
  console.log('='.repeat(80));

  // ============================================================================
  // Demo 1: agent.generate() with processors - Successful request
  // ============================================================================
  console.log('\n📋 Demo 1: agent.generate() - Successful Request\n');
  console.log('-'.repeat(40));

  try {
    // This message is clean - no PII or toxic content
    const result = await moderatedAssistantAgent.generate('What is the capital of France?');

    console.log('✅ Response received:');
    console.log('  Text:', result.text.substring(0, 100) + '...');
  } catch (error) {
    console.error('Error:', error);
  }

  // ============================================================================
  // Demo 2: agent.generate() - PII Detection Tripwire
  // ============================================================================
  console.log('\n📋 Demo 2: agent.generate() - PII Detection Tripwire\n');
  console.log('-'.repeat(40));

  try {
    // This message contains an email - will trigger PII detection
    const result = await moderatedAssistantAgent.generate('My email is john@example.com, please contact me');

    // If we get here, the message wasn't blocked
    console.log('Response:', result.text);
  } catch (error: any) {
    // TripWire errors are thrown when content is blocked
    if (error.name === 'TripWire' || error.message?.includes('Personal information')) {
      console.log('🚫 Content blocked by processor!');
      console.log('  Error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }

  // ============================================================================
  // Demo 3: agent.stream() - Handling tripwire during streaming
  // ============================================================================
  console.log('\n📋 Demo 3: agent.stream() - Tripwire Handling\n');
  console.log('-'.repeat(40));

  try {
    // This message contains SSN pattern - will trigger PII detection
    const stream = await moderatedAssistantAgent.stream('My SSN is 123-45-6789');

    // When streaming, tripwires appear as chunks in the stream
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tripwire') {
        console.log('🚫 Tripwire detected during streaming!');
        console.log('  Reason:', chunk.payload?.reason);
        console.log('  Retry allowed:', chunk.payload?.retry);
        console.log('  Metadata:', JSON.stringify(chunk.payload?.metadata, null, 2));
        console.log('  Processor ID:', chunk.payload?.processorId);
        break;
      } else if (chunk.type === 'text-delta') {
        // Normal text streaming
        process.stdout.write(chunk.payload?.text || '');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // ============================================================================
  // Demo 4: agent.stream() - Toxicity Detection
  // ============================================================================
  console.log('\n📋 Demo 4: agent.stream() - Toxicity Detection\n');
  console.log('-'.repeat(40));

  try {
    // This message contains "hate" - will trigger toxicity check
    const stream = await moderatedAssistantAgent.stream('I hate everything about this');

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tripwire') {
        console.log('🚫 Toxic content detected!');
        console.log('  Reason:', chunk.payload?.reason);
        console.log('  Toxicity metadata:', JSON.stringify(chunk.payload?.metadata, null, 2));
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // ============================================================================
  // Demo 5: Agent with Processor Workflow
  // ============================================================================
  console.log('\n📋 Demo 5: Agent with Processor Workflow\n');
  console.log('-'.repeat(40));

  try {
    // This agent uses a processor workflow (chain of processors) instead of individual processors
    const stream = await agentWithProcessorWorkflow.stream('Contact me at test@example.com');

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tripwire') {
        console.log('🚫 Processor workflow blocked the content!');
        console.log('  Reason:', chunk.payload?.reason);
        console.log('  Metadata:', JSON.stringify(chunk.payload?.metadata, null, 2));
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // ============================================================================
  // Demo 6: Comparison - Simple Agent without processors
  // ============================================================================
  console.log('\n📋 Demo 6: Simple Agent (no processors)\n');
  console.log('-'.repeat(40));

  try {
    // This agent has no processors - the same content goes through
    const result = await simpleAssistantAgent.generate('My email is john@example.com');

    console.log('✅ No processors - content goes through:');
    console.log('  Response:', result.text.substring(0, 100) + '...');
  } catch (error) {
    console.error('Error:', error);
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('✅ Demo Complete!\n');
  console.log('Key patterns demonstrated:');
  console.log('');
  console.log('  1. Individual processors on agent:');
  console.log('     inputProcessors: [piiDetector, toxicityChecker]');
  console.log('     outputProcessors: [qualityChecker, logger]');
  console.log('');
  console.log('  2. Processor workflow on agent:');
  console.log('     inputProcessors: [contentModerationWorkflow]');
  console.log('');
  console.log('  3. Handling tripwires with generate():');
  console.log('     try { await agent.generate(...) } catch (e) { /* handle tripwire */ }');
  console.log('');
  console.log('  4. Handling tripwires with stream():');
  console.log('     for await (const chunk of stream.fullStream) {');
  console.log('       if (chunk.type === "tripwire") { /* handle tripwire */ }');
  console.log('     }');
}

main().catch(console.error);
