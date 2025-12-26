/**
 * Seed Script for Training Data
 *
 * This script generates realistic customer support conversations
 * by running the support agent with various prompts. The resulting
 * traces are stored in the database and can be used for training.
 *
 * Run with: pnpm seed
 */

import { mastra, supportAgent } from './mastra';

// Sample customer support queries that simulate real interactions
const seedPrompts = [
  // Product inquiries
  'What can you tell me about product PROD-001?',
  'Is the mechanical keyboard (PROD-004) still in stock?',
  "I'm looking for a webcam. What do you have available?",
  'How much is the laptop stand?',
  'Can you check if PROD-008 is available for delivery to 90210?',
  "What's the price difference between PROD-001 and PROD-005?",

  // Order status inquiries
  'Can you check the status of order ORD-1001?',
  "Where is my order ORD-1002? I've been waiting for days.",
  'I placed order ORD-1003 recently. When will it ship?',
  "What happened to order ORD-1005? I don't see it in my account.",
  'Can you give me details about order ORD-1004?',

  // Customer lookup with context
  "Hi, I'm customer CUST-100 and I need help with my recent orders.",
  "I'm Alice Johnson (CUST-100). Can you look up my account?",
  'What membership tier is customer CUST-101?',

  // Refund requests
  "I'd like a refund for order ORD-1001. The headphones stopped working.",
  'Can I get my money back for order ORD-1005? I cancelled it.',
  "I want to return order ORD-1002 - it hasn't arrived yet.",
  'Order ORD-1003 is still processing but I changed my mind. Can I cancel and get a refund?',

  // Availability checks
  'Can I get the wireless headphones delivered to 10001?',
  'Check if PROD-003 can be delivered to 94105 by next week.',
  'Is PROD-007 available for shipping to 33101?',
  'How long would delivery take for PROD-002 to 60601?',

  // Complex multi-part queries
  'I ordered PROD-004 (order ORD-1002) but want to also add a mouse pad. Is PROD-006 in stock?',
  "I'm customer CUST-102. Can you check my order ORD-1004 and tell me when it will arrive at 90210?",
  'My name is Bob Smith. I have order ORD-1002. Can you check the status and also tell me about your return policy?',
  "I'm interested in buying PROD-001 and PROD-008 together. Are both in stock and how much would that cost?",

  // Edge cases and difficult queries
  'I lost my order number but I bought headphones last week. Can you help?',
  "What's the warranty on PROD-004?",
  'Do you have any products under $20?',
  "I'm not happy with my purchase. What are my options?",
  'Can you price match this product I found cheaper elsewhere?',

  // Follow-up style queries
  'Thanks for the info! Now can you check product PROD-002 as well?',
  "That's helpful. What about delivery to 98101?",
  "Great, and what's the status of ORD-1001 again?",

  // Vague queries that require clarification
  'I need help with an order.',
  "Something's wrong with my delivery.",
  'Can you look something up for me?',
  'I have a question about a product.',
];

async function seed() {
  console.log('🌱 Starting seed process...\n');
  console.log(`Will generate ${seedPrompts.length} traces from the support agent.\n`);

  const results = {
    success: 0,
    failed: 0,
    traces: [] as string[],
  };

  for (let i = 0; i < seedPrompts.length; i++) {
    const prompt = seedPrompts[i]!;
    console.log(`[${i + 1}/${seedPrompts.length}] Processing: "${prompt.substring(0, 50)}..."`);

    try {
      const response = await supportAgent.generate(prompt);
      results.success++;
      console.log(`  ✅ Response: "${response.text.substring(0, 80)}..."\n`);
    } catch (error) {
      results.failed++;
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Seed Results:');
  console.log(`  ✅ Successful: ${results.success}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log(`  📝 Total traces generated: ${results.success}`);

  console.log('\n✨ Seed complete! Traces are now stored in mastra.db');
  console.log('   You can now run `pnpm train` to start training from these traces.');
}

// Run the seed
seed().catch(console.error);
