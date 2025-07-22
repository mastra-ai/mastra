#!/usr/bin/env node

/**
 * Simple AgentBuilder Test Runner (JavaScript)
 *
 * Quick validation script for AgentBuilder capabilities.
 * Run with: node simple-test.js [custom-prompt]
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

async function loadDependencies() {
  try {
    const { openai } = await import('@ai-sdk/openai');
    const { AgentBuilder } = await import('./dist/index.js');
    return { openai, AgentBuilder };
  } catch (error) {
    console.error('❌ Failed to load dependencies. Make sure to build the package first:');
    console.error('   pnpm build');
    console.error('   pnpm install @ai-sdk/openai');
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

async function runTest(customPrompt = null) {
  console.log('🧪 AgentBuilder Validation Test');
  console.log('==============================\n');

  // Load dependencies dynamically
  const { openai, AgentBuilder } = await loadDependencies();

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
## Test Validation Mode

Create a complete, production-ready Mastra project. This is a validation test.

### Critical Requirements:
1. **Complete Implementation**: Create fully functional code, not prototypes
2. **No TODOs**: All code should be working and complete
3. **Production Quality**: Follow all Mastra best practices
4. **Real Integration**: Use actual APIs where specified
5. **Proper Architecture**: Follow Mastra project structure conventions
6. **Full Documentation**: Include comprehensive setup and usage docs

### Success Criteria:
- Project can be installed and run immediately
- All features work as specified
- Code follows TypeScript/Mastra best practices
- Includes proper error handling and validation
- Has complete documentation

**Demonstrate your full capabilities!**
    `,
  });

  // Default test prompt
  const defaultPrompt = `Create a complete Mastra weather agent project that includes:

1. A weather agent that gets real-time weather data using a free weather API (OpenWeatherMap)
2. SQLite memory integration to remember conversation history
3. Custom tools for weather queries and recommendations
4. A working API server with RESTful endpoints
5. Proper TypeScript types and Zod validation schemas
6. Environment configuration (.env.example)
7. Complete package.json with all necessary dependencies
8. Comprehensive documentation

Requirements:
- The project should be immediately runnable after setup
- Include proper error handling and logging
- Follow Mastra best practices and conventions
- Create a production-ready system, not a prototype
- Include setup instructions and API documentation

Make this a complete, working Mastra application.`;

  const prompt = customPrompt || defaultPrompt;

  console.log('📤 Sending prompt to AgentBuilder...\n');
  console.log(`📝 Prompt: ${prompt.substring(0, 200)}...\n`);

  try {
    const startTime = Date.now();

    // Execute the test
    console.log('⚡ Executing AgentBuilder...');
    const response = await agentBuilder.generate(prompt);

    const executionTime = Date.now() - startTime;

    console.log(`\n✅ Test completed in ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📁 Output directory: ${testDir}`);

    // Basic validation
    console.log('\n📋 Basic File Validation:');
    const expectedFiles = ['package.json', 'README.md', 'src/mastra.ts', '.env.example'];

    let filesFound = 0;
    expectedFiles.forEach(file => {
      const exists = existsSync(join(testDir, file));
      console.log(`   ${exists ? '✅' : '❌'} ${file}`);
      if (exists) filesFound++;
    });

    // Additional file discovery
    console.log('\n📁 Generated Files:');
    try {
      const allFiles = getAllFiles(testDir);
      console.log(`   Found ${allFiles.length} total files`);
      if (allFiles.length > 0) {
        console.log('   Sample files:', allFiles.slice(0, 5).join(', '));
      }
    } catch (error) {
      console.log('   Could not scan directory');
    }

    console.log(`\n🤖 Agent Response Preview:`);
    const responseText = response.text || 'No response text available';
    console.log(`${responseText.substring(0, 400)}...\n`);

    // Calculate basic score
    const score = Math.round((filesFound / expectedFiles.length) * 100);
    console.log(`📊 Basic Score: ${score}% (${filesFound}/${expectedFiles.length} expected files found)`);

    console.log('\n🎯 Manual Validation Steps:');
    console.log('1. Review generated files in test-output directory');
    console.log('2. Check package.json for correct dependencies');
    console.log('3. Verify TypeScript configuration (tsconfig.json)');
    console.log('4. Test if project builds: cd test-output && npm install && npm run build');
    console.log('5. Check if server starts: npm run dev');
    console.log('6. Validate API endpoints work correctly');
    console.log('7. Review code quality and Mastra best practices');

    // Success determination
    if (score >= 75) {
      console.log('\n🌟 SUCCESS: AgentBuilder appears to be working well!');
    } else {
      console.log('\n⚠️  PARTIAL: Some expected files missing. Review output.');
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

function getAllFiles(dir, files = []) {
  try {
    const fs = require('fs');
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        getAllFiles(join(dir, entry.name), files);
      } else if (entry.isFile()) {
        files.push(entry.name);
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return files;
}

function showHelp() {
  console.log(`
🧪 AgentBuilder Test Runner

Usage:
  node simple-test.js                              # Run default weather agent test
  node simple-test.js "Custom prompt here"         # Run with custom prompt

Examples:
  node simple-test.js "Create a todo app with Mastra and SQLite"
  node simple-test.js "Build an e-commerce chatbot with product search"
  node simple-test.js "Make a data analysis agent for CSV files"

Prerequisites:
  1. Build the package: pnpm build
  2. Install AI SDK: pnpm install @ai-sdk/openai
  3. Set OpenAI API key: export OPENAI_API_KEY=your-key

The test will:
1. Create a test-output directory
2. Initialize AgentBuilder with proper configuration
3. Execute your prompt
4. Validate basic file structure
5. Provide manual validation steps
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const customPrompt = args.length > 0 ? args.join(' ') : null;
  await runTest(customPrompt);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
