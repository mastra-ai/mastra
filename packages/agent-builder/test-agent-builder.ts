#!/usr/bin/env node

import { openai } from '@ai-sdk/openai';
import { AgentBuilder } from './src/index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

/**
 * Comprehensive AgentBuilder Test Suite
 *
 * This script validates the AgentBuilder's ability to:
 * 1. Create complete Mastra projects from natural language prompts
 * 2. Execute complex multi-step tasks
 * 3. Generate production-ready code
 * 4. Follow Mastra best practices
 */

interface TestScenario {
  name: string;
  description: string;
  prompt: string;
  validationCriteria: string[];
  expectedFiles: string[];
  expectedFeatures: string[];
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Weather Agent Project',
    description: 'Create a complete weather agent with real-time weather data, memory, and API integration',
    prompt: `Create a complete Mastra weather agent project that can:
    
1. Get real-time weather data for any city using a free weather API
2. Remember previous weather queries in a SQLite database
3. Provide detailed weather forecasts with recommendations
4. Handle multiple cities and compare weather conditions
5. Include proper error handling and validation
6. Set up a working API server with endpoints
7. Include environment configuration and documentation

The agent should be production-ready with:
- Proper TypeScript types
- Zod validation schemas
- Memory integration for conversation history
- RESTful API endpoints
- Error handling and logging
- Environment variable configuration
- Setup documentation

Make this a complete, working project that I can run immediately.`,
    validationCriteria: [
      'Project structure follows Mastra conventions',
      'Contains working weather API integration',
      'Implements SQLite memory storage',
      'Includes proper TypeScript types',
      'Has Zod validation schemas',
      'Contains API server setup',
      'Includes environment configuration',
      'Has comprehensive error handling',
      'Contains setup documentation',
      'Code is production-ready (no TODOs unless necessary)',
    ],
    expectedFiles: [
      'package.json',
      'src/mastra.ts',
      'src/agents/weather-agent.ts',
      'src/tools/weather-tool.ts',
      'src/server.ts',
      '.env.example',
      'README.md',
      'tsconfig.json',
    ],
    expectedFeatures: [
      'Weather API integration',
      'Memory with SQLite',
      'Agent configuration',
      'Server endpoints',
      'Environment setup',
      'TypeScript configuration',
    ],
  },
  {
    name: 'E-commerce Chatbot',
    description: 'Create an e-commerce customer service chatbot with product search and order management',
    prompt: `Build a complete e-commerce customer service chatbot using Mastra that can:

1. Search products in a mock product database
2. Handle customer inquiries about orders, shipping, returns
3. Escalate complex issues to human agents
4. Track conversation history and customer context
5. Integration with webhook endpoints for order updates
6. Multi-channel support (web, API endpoints)

Requirements:
- Complete Mastra project structure
- Product search functionality with filters
- Order status checking tools
- Customer context memory
- Escalation workflows
- Webhook integrations
- API documentation
- Full TypeScript implementation
- Production deployment ready

Create a fully functional system that demonstrates real-world e-commerce chatbot capabilities.`,
    validationCriteria: [
      'Complete e-commerce chatbot implementation',
      'Product search functionality',
      'Order management tools',
      'Customer memory and context',
      'Escalation workflows',
      'Webhook integration',
      'Multi-channel API support',
      'Comprehensive documentation',
      'Production-ready deployment setup',
    ],
    expectedFiles: [
      'package.json',
      'src/mastra.ts',
      'src/agents/ecommerce-agent.ts',
      'src/tools/product-search-tool.ts',
      'src/tools/order-management-tool.ts',
      'src/workflows/escalation-workflow.ts',
      'src/server.ts',
      'src/data/products.json',
      '.env.example',
      'README.md',
    ],
    expectedFeatures: [
      'Product search',
      'Order management',
      'Customer memory',
      'Escalation logic',
      'Webhook handling',
      'API endpoints',
    ],
  },
  {
    name: 'Data Analysis Agent',
    description: 'Create a data analysis agent that can process CSV files and generate insights',
    prompt: `Create a Mastra data analysis agent that can:

1. Upload and process CSV files
2. Perform statistical analysis (mean, median, correlations)
3. Generate data visualizations (charts, graphs)
4. Create summary reports in multiple formats
5. Handle large datasets efficiently
6. Export results as PDF reports
7. Cache analysis results for faster re-access

Features needed:
- File upload handling
- Data processing tools
- Statistical analysis functions
- Chart generation (using a charting library)
- Report generation
- Caching mechanism
- Multi-format export
- Comprehensive error handling
- Performance optimization

Build this as a complete, production-ready system with proper architecture and documentation.`,
    validationCriteria: [
      'CSV file processing capabilities',
      'Statistical analysis implementation',
      'Data visualization generation',
      'Report generation system',
      'Caching mechanism',
      'Multi-format export',
      'Performance optimization',
      'Production-ready architecture',
    ],
    expectedFiles: [
      'package.json',
      'src/mastra.ts',
      'src/agents/data-analysis-agent.ts',
      'src/tools/csv-processor-tool.ts',
      'src/tools/statistical-analysis-tool.ts',
      'src/tools/chart-generator-tool.ts',
      'src/tools/report-generator-tool.ts',
      'src/utils/cache.ts',
      'src/server.ts',
      '.env.example',
      'README.md',
    ],
    expectedFeatures: [
      'CSV processing',
      'Statistical analysis',
      'Chart generation',
      'Report creation',
      'Caching system',
      'File handling',
    ],
  },
];

class AgentBuilderTester {
  private agentBuilder: AgentBuilder;
  private testDir: string;
  private results: Map<string, TestResult> = new Map();

  constructor() {
    this.testDir = resolve(process.cwd(), 'agent-builder-tests');
    this.setupTestEnvironment();
    this.initializeAgentBuilder();
  }

  private setupTestEnvironment() {
    // Create test directory
    if (!existsSync(this.testDir)) {
      mkdirSync(this.testDir, { recursive: true });
    }

    console.log(`🧪 Test environment setup at: ${this.testDir}`);
  }

  private initializeAgentBuilder() {
    this.agentBuilder = new AgentBuilder({
      model: openai('gpt-4o'),
      summaryModel: openai('gpt-4o-mini'),
      projectPath: this.testDir,
      instructions: `
## Test Mode Instructions

You are being tested for your ability to create complete, production-ready Mastra projects.

### Critical Requirements:
1. **Complete Implementation**: Create fully functional code, not prototypes
2. **No TODOs**: All code should be working and complete
3. **Production Quality**: Follow all Mastra best practices
4. **Real Integration**: Use actual APIs and services where specified
5. **Proper Architecture**: Follow Mastra project structure conventions
6. **Full Documentation**: Include comprehensive setup and usage docs

### Success Criteria:
- Project runs immediately after setup
- All features work as specified  
- Code follows TypeScript/Mastra best practices
- Includes proper error handling and validation
- Has complete documentation

**This is a validation test - demonstrate your full capabilities!**
      `,
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting AgentBuilder Comprehensive Test Suite\n');
    console.log(`📍 Test Directory: ${this.testDir}\n`);

    for (const scenario of TEST_SCENARIOS) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🧪 Running Test: ${scenario.name}`);
      console.log(`📝 Description: ${scenario.description}`);
      console.log(`${'='.repeat(80)}\n`);

      try {
        const result = await this.runTest(scenario);
        this.results.set(scenario.name, result);
        this.displayTestResult(scenario, result);
      } catch (error) {
        console.error(`❌ Test failed with error:`, error);
        this.results.set(scenario.name, {
          success: false,
          score: 0,
          details: [`Error: ${error instanceof Error ? error.message : String(error)}`],
          generatedFiles: [],
          executionTime: 0,
        });
      }
    }

    this.displaySummary();
  }

  private async runTest(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const projectDir = join(this.testDir, scenario.name.toLowerCase().replace(/\s+/g, '-'));

    // Create project directory
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    console.log(`📂 Project Directory: ${projectDir}`);
    console.log(`📤 Sending prompt to AgentBuilder...\n`);

    // Update agent builder project path for this test
    const testAgentBuilder = new AgentBuilder({
      model: openai('gpt-4o'),
      summaryModel: openai('gpt-4o-mini'),
      projectPath: projectDir,
      instructions: this.agentBuilder['builderConfig'].instructions,
    });

    // Execute the prompt
    const response = await testAgentBuilder.generate(scenario.prompt);
    const executionTime = Date.now() - startTime;

    console.log(`⏱️  Execution completed in ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📋 Validating results...\n`);

    // Validate the results
    const validation = this.validateResults(projectDir, scenario);

    return {
      success: validation.score >= 70, // 70% threshold for success
      score: validation.score,
      details: validation.details,
      generatedFiles: validation.generatedFiles,
      executionTime,
      agentResponse: this.truncateResponse(response.text || 'No response text'),
    };
  }

  private validateResults(projectDir: string, scenario: TestScenario): ValidationResult {
    const details: string[] = [];
    let score = 0;
    const maxScore = 100;
    const generatedFiles: string[] = [];

    // Check for expected files (40 points)
    const fileScore = this.validateFiles(projectDir, scenario.expectedFiles, details, generatedFiles);
    score += fileScore;

    // Check for expected features in code (30 points)
    const featureScore = this.validateFeatures(projectDir, scenario.expectedFeatures, details);
    score += featureScore;

    // Check validation criteria (30 points)
    const criteriaScore = this.validateCriteria(projectDir, scenario.validationCriteria, details);
    score += criteriaScore;

    return {
      score: Math.round(score),
      details,
      generatedFiles,
    };
  }

  private validateFiles(
    projectDir: string,
    expectedFiles: string[],
    details: string[],
    generatedFiles: string[],
  ): number {
    const fileWeight = 40 / expectedFiles.length;
    let score = 0;

    for (const file of expectedFiles) {
      const filePath = join(projectDir, file);
      if (existsSync(filePath)) {
        score += fileWeight;
        details.push(`✅ File exists: ${file}`);
        generatedFiles.push(file);
      } else {
        details.push(`❌ Missing file: ${file}`);
      }
    }

    // Check for additional files
    try {
      const allFiles = this.getAllFiles(projectDir);
      const additionalFiles = allFiles.filter(f => !expectedFiles.includes(f));
      if (additionalFiles.length > 0) {
        details.push(
          `📁 Additional files: ${additionalFiles.slice(0, 5).join(', ')}${additionalFiles.length > 5 ? '...' : ''}`,
        );
        generatedFiles.push(...additionalFiles);
      }
    } catch (error) {
      details.push(`⚠️  Could not scan directory: ${error instanceof Error ? error.message : String(error)}`);
    }

    return score;
  }

  private validateFeatures(projectDir: string, expectedFeatures: string[], details: string[]): number {
    const featureWeight = 30 / expectedFeatures.length;
    let score = 0;

    for (const feature of expectedFeatures) {
      const found = this.searchForFeature(projectDir, feature);
      if (found) {
        score += featureWeight;
        details.push(`✅ Feature implemented: ${feature}`);
      } else {
        details.push(`❌ Feature missing: ${feature}`);
      }
    }

    return score;
  }

  private validateCriteria(projectDir: string, criteria: string[], details: string[]): number {
    const criteriaWeight = 30 / criteria.length;
    let score = 0;

    for (const criterion of criteria) {
      // Simple heuristic validation - in a real test you'd have more sophisticated checks
      const validated = this.validateCriterion(projectDir, criterion);
      if (validated) {
        score += criteriaWeight;
        details.push(`✅ Criterion met: ${criterion}`);
      } else {
        details.push(`❌ Criterion not met: ${criterion}`);
      }
    }

    return score;
  }

  private searchForFeature(projectDir: string, feature: string): boolean {
    try {
      const searchTerms = feature.toLowerCase().split(' ');
      const files = this.getAllFiles(projectDir, ['.ts', '.js', '.json']);

      for (const file of files) {
        try {
          const content = readFileSync(join(projectDir, file), 'utf-8').toLowerCase();
          if (searchTerms.some(term => content.includes(term))) {
            return true;
          }
        } catch {
          // Skip files that can't be read
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private validateCriterion(projectDir: string, criterion: string): boolean {
    // Simplified validation - you could make this more sophisticated
    const lowerCriterion = criterion.toLowerCase();

    if (lowerCriterion.includes('typescript')) {
      return existsSync(join(projectDir, 'tsconfig.json'));
    }
    if (lowerCriterion.includes('package.json')) {
      return existsSync(join(projectDir, 'package.json'));
    }
    if (lowerCriterion.includes('documentation') || lowerCriterion.includes('readme')) {
      return existsSync(join(projectDir, 'README.md'));
    }
    if (lowerCriterion.includes('environment')) {
      return existsSync(join(projectDir, '.env.example')) || existsSync(join(projectDir, '.env'));
    }

    // Default to searching for keywords in code
    return this.searchForFeature(projectDir, criterion);
  }

  private getAllFiles(dir: string, extensions: string[] = []): string[] {
    const files: string[] = [];

    try {
      const entries = require('fs').readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = this.getAllFiles(join(dir, entry.name), extensions);
          files.push(...subFiles.map(f => join(entry.name, f)));
        } else if (entry.isFile()) {
          if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(entry.name);
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return files;
  }

  private displayTestResult(scenario: TestScenario, result: TestResult): void {
    console.log(`\n📊 Test Results for: ${scenario.name}`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`🎯 Success: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📈 Score: ${result.score}/100`);
    console.log(`⏱️  Execution Time: ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log(`📁 Generated Files: ${result.generatedFiles.length}`);

    console.log(`\n📝 Validation Details:`);
    result.details.forEach(detail => console.log(`   ${detail}`));

    if (result.agentResponse) {
      console.log(`\n🤖 Agent Response Preview:`);
      console.log(`   ${result.agentResponse.substring(0, 200)}...`);
    }
  }

  private displaySummary(): void {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 AGENT BUILDER TEST SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);

    const results = Array.from(this.results.entries());
    const totalTests = results.length;
    const passedTests = results.filter(([, result]) => result.success).length;
    const averageScore = results.reduce((sum, [, result]) => sum + result.score, 0) / totalTests;
    const totalTime = results.reduce((sum, [, result]) => sum + result.executionTime, 0);

    console.log(`📈 Overall Performance:`);
    console.log(`   Tests Passed: ${passedTests}/${totalTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log(`   Average Score: ${averageScore.toFixed(1)}/100`);
    console.log(`   Total Execution Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Average Time per Test: ${(totalTime / totalTests / 1000).toFixed(2)}s`);

    console.log(`\n📋 Individual Test Results:`);
    results.forEach(([name, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${name}: ${result.score}/100`);
    });

    console.log(`\n🎯 Recommendations:`);
    if (averageScore >= 85) {
      console.log(`   🌟 Excellent! AgentBuilder is performing at production level.`);
    } else if (averageScore >= 70) {
      console.log(`   👍 Good performance. Some areas for improvement identified.`);
    } else {
      console.log(`   ⚠️  Needs improvement. Review failed criteria and enhance capabilities.`);
    }

    console.log(`\n📁 Test artifacts available at: ${this.testDir}`);
    console.log(`🔍 Review generated projects to validate quality and completeness.`);
  }

  private truncateResponse(text: string): string {
    return text.length > 500 ? text.substring(0, 500) + '...' : text;
  }
}

interface TestResult {
  success: boolean;
  score: number;
  details: string[];
  generatedFiles: string[];
  executionTime: number;
  agentResponse?: string;
}

interface ValidationResult {
  score: number;
  details: string[];
  generatedFiles: string[];
}

// Main execution
async function main() {
  console.log('🧪 AgentBuilder Validation Test Suite');
  console.log('=====================================\n');

  const tester = new AgentBuilderTester();

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { AgentBuilderTester, TEST_SCENARIOS };
