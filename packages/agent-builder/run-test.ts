#!/usr/bin/env node

/**
 * AgentBuilder Test Runner
 *
 * Simple script to test AgentBuilder capabilities with a single prompt.
 * Use this to quickly validate specific functionality.
 */

import { openai } from '@ai-sdk/openai';
import { AgentBuilder } from './src/index.js';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

async function runSingleTest() {
  console.log('🧪 AgentBuilder Single Test Runner');
  console.log('==================================\n');

  // Set up test environment
  const testDir = resolve(process.cwd(), 'test-output');
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  console.log(`📁 Test output directory: ${testDir}\n`);

  // Initialize AgentBuilder
  const agentBuilder = new AgentBuilder({
    model: openai('gpt-4o'),
    summaryModel: openai('gpt-4o-mini'),
    projectPath: testDir,
    instructions: `
## Single Test Mode

You are being tested to validate your AgentBuilder capabilities. Create complete, production-ready Mastra projects.

### Requirements:
1. **Complete Implementation**: Create fully functional code
2. **No TODOs**: All code should be working and complete  
3. **Production Quality**: Follow Mastra best practices
4. **Real Integration**: Use actual APIs where specified
5. **Proper Architecture**: Follow Mastra conventions
6. **Full Documentation**: Include setup and usage docs

**Demonstrate your full capabilities with a working project!**
    `,
  });

  // Test prompt - you can modify this to test different scenarios
  const testPrompt = `Create a complete Mastra weather agent project that includes:

1. A weather agent that gets real-time weather data using the OpenWeatherMap API
2. SQLite memory to remember conversation history 
3. Custom tools for getting weather and providing recommendations
4. A working API server with endpoints
5. Proper TypeScript types and Zod validation
6. Environment configuration and documentation
7. Complete package.json with all dependencies

Make this a complete, working project that I can:
- Install dependencies with npm/pnpm install
- Set up environment variables
- Run the server immediately
- Test the weather endpoints

Include all necessary files and comprehensive documentation.`;

  console.log('📤 Sending test prompt to AgentBuilder...\n');
  console.log(`📝 Prompt: ${testPrompt.substring(0, 200)}...\n`);

  try {
    const startTime = Date.now();

    // Execute the test
    const response = await agentBuilder.generate(testPrompt);

    const executionTime = Date.now() - startTime;

    console.log(`✅ Test completed in ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📁 Check output directory: ${testDir}`);

    // Basic validation
    console.log('\n📋 Basic Validation:');
    const expectedFiles = ['package.json', 'README.md', 'src/mastra.ts'];

    expectedFiles.forEach(file => {
      const exists = existsSync(join(testDir, file));
      console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    });

    console.log(`\n🤖 Agent Response Preview:`);
    console.log(`${response.text?.substring(0, 500) || 'No response text'}...\n`);

    console.log('🎯 Next Steps:');
    console.log('1. Review generated files in the test-output directory');
    console.log('2. Check if package.json has correct dependencies');
    console.log('3. Verify TypeScript configuration');
    console.log('4. Test if the project builds and runs');
    console.log('5. Validate API endpoints work correctly');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Enhanced test with custom prompt
async function runCustomTest(customPrompt: string) {
  console.log('🧪 AgentBuilder Custom Test Runner');
  console.log('===================================\n');

  const testDir = resolve(process.cwd(), 'custom-test-output');
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  const agentBuilder = new AgentBuilder({
    model: openai('gpt-4o'),
    summaryModel: openai('gpt-4o-mini'),
    projectPath: testDir,
  });

  console.log(`📝 Custom Prompt: ${customPrompt}\n`);

  try {
    const startTime = Date.now();
    const response = await agentBuilder.generate(customPrompt);
    const executionTime = Date.now() - startTime;

    console.log(`✅ Custom test completed in ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📁 Output directory: ${testDir}`);
    console.log(`🤖 Response: ${response.text?.substring(0, 300) || 'No response'}...\n`);
  } catch (error) {
    console.error('❌ Custom test failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Custom prompt provided
    const customPrompt = args.join(' ');
    await runCustomTest(customPrompt);
  } else {
    // Run default test
    await runSingleTest();
  }
}

// Help function
function showHelp() {
  console.log(`
🧪 AgentBuilder Test Runner

Usage:
  node run-test.ts                           # Run default weather agent test
  node run-test.ts "Custom prompt here"      # Run with custom prompt

Examples:
  node run-test.ts "Create a todo app with Mastra"
  node run-test.ts "Build an e-commerce chatbot with product search"
  node run-test.ts "Make a data analysis agent for CSV files"

The script will:
1. Create a test output directory
2. Initialize AgentBuilder with the project path
3. Execute your prompt
4. Show basic validation results
5. Provide next steps for manual validation
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
} else {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
