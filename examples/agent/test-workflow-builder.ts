#!/usr/bin/env bun

import { openai } from '@ai-sdk/openai';
import { workflowBuilderWorkflow, createWorkflowWithBuilder, editWorkflowWithBuilder } from '@mastra/agent-builder';
import { RuntimeContext } from '@mastra/core/di';

const PROJECT_PATH = '/Users/daniellew/Documents/Mastra/mastra2/examples/agent';

async function main() {
  console.log('🚀 Testing Mastra Workflow Builder');
  console.log('===================================\n');

  // Set up runtime context with model
  const runtimeContext = new RuntimeContext();
  runtimeContext.set('model', openai('gpt-4o'));
  runtimeContext.set('projectPath', PROJECT_PATH);

  try {
    // Test 1: Discover existing workflows
    // console.log('📊 Test 1: Discovering existing workflows...');
    // const discoveryResult = await discoverWorkflows(PROJECT_PATH);

    // if (discoveryResult.success) {
    //   console.log('✅ Discovery successful!');
    //   console.log(`Found ${discoveryResult.discovery?.workflows.length || 0} existing workflows:`);
    //   discoveryResult.discovery?.workflows.forEach((workflow, index) => {
    //     console.log(`  ${index + 1}. ${workflow.name} (${workflow.file})`);
    //     if (workflow.description) {
    //       console.log(`     Description: ${workflow.description}`);
    //     }
    //   });
    //   console.log(`Mastra index exists: ${discoveryResult.discovery?.mastraIndexExists}\n`);
    // } else {
    //   console.log('❌ Discovery failed:', discoveryResult.error);
    // }

    // Test 2: Create a specific email workflow
    console.log('📧 Test 2: Creating an email sending workflow...');
    const createResult = await createWorkflowWithBuilder(
      'email-sender-workflow',
      'A workflow that sends emails to users',
      `Create an email sending workflow that:
      1. Takes user email address, subject, and message content as input
      2. Validates the email format using proper email validation
      3. Sends the email using an email service API (like SendGrid or similar)
      4. Handles email sending errors and retries if needed
      5. Returns success/failure status with details
      
      Include proper error handling for invalid emails, API failures, and network issues.
      Use Zod schemas for input validation and TypeScript for type safety.`,
      PROJECT_PATH,
    );

    console.log(JSON.stringify(createResult, null, 2));

    if (createResult.success) {
      console.log('✅ Workflow creation successful!');
      console.log(`Created workflow: ${createResult.workflowName}`);
      console.log(`File location: ${createResult.workflowFile}`);
      console.log('Next steps:', createResult.nextSteps?.join(', '));

      if (createResult.execution?.validationResults.passed) {
        console.log('✅ Validation passed');
      } else {
        console.log('⚠️  Validation issues:', createResult.execution?.validationResults.errors);
      }
    } else {
      console.log('❌ Workflow creation failed:', createResult.error);
    }

    console.log('\n' + '='.repeat(50));

    // Test 3: Use the main workflow directly for more control
    // console.log('🔧 Test 3: Using main workflow directly...');

    // const run = await workflowBuilderWorkflow.createRunAsync();
    // const mainResult = await run.start({
    //   inputData: {
    //     action: 'create',
    //     workflowName: 'emailValidator',
    //     description: 'Validate and categorize email addresses',
    //     requirements: `
    //       Create a workflow that:
    //       - Accepts an email address as input
    //       - Validates the email format using regex
    //       - Checks if the domain exists
    //       - Categorizes the email (personal, business, educational)
    //       - Returns validation results and category
    //     `,
    //     projectPath: PROJECT_PATH
    //   },
    //   runtimeContext
    // });

    // if (mainResult.success) {
    //   console.log('✅ Main workflow execution successful!');
    //   console.log(`Action: ${mainResult.action}`);
    //   console.log(`Workflow: ${mainResult.workflowName}`);
    //   console.log(`Message: ${mainResult.message}`);

    //   // Show discovery results if available
    //   if (mainResult.discovery) {
    //     console.log(`\nProject Discovery:`);
    //     console.log(`- Workflows found: ${mainResult.discovery.workflows.length}`);
    //     console.log(`- Mastra index exists: ${mainResult.discovery.mastraIndexExists}`);
    //   }

    //   // Show execution results if available
    //   if (mainResult.execution) {
    //     console.log(`\nExecution Results:`);
    //     console.log(`- Files modified: ${mainResult.execution.filesModified.length}`);
    //     console.log(`- Tasks completed: ${mainResult.execution.completedTasks.length}`);
    //     console.log(`- Validation passed: ${mainResult.execution.validationResults.passed}`);
    //   }

    //   if (mainResult.nextSteps) {
    //     console.log('\nNext steps:');
    //     mainResult.nextSteps.forEach((step, index) => {
    //       console.log(`  ${index + 1}. ${step}`);
    //     });
    //   }
    // } else {
    //   console.log('❌ Main workflow execution failed:', mainResult.error);
    // }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  console.log('\n🏁 Workflow Builder testing completed!');
}

// Handle command line arguments for specific tests
const args = process.argv.slice(2);
const testNumber = args[0];

async function runSpecificTest(testNum: string) {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set('model', openai('gpt-4o'));
  runtimeContext.set('projectPath', PROJECT_PATH);

  switch (testNum) {
    case '2':
      console.log('Running Test 2: Simple workflow creation');
      const createResult = await createWorkflowWithBuilder(
        'simpleCalculator',
        'Basic calculator workflow',
        'Create a workflow that adds two numbers and returns the result',
        PROJECT_PATH,
      );
      console.log(JSON.stringify(createResult, null, 2));
      break;

    case '3':
      console.log('Running Test 3: Custom workflow with main workflow');
      const run = await workflowBuilderWorkflow.createRunAsync();
      const customResult = await run.start({
        inputData: {
          action: 'create',
          workflowName: 'customTest',
          description: 'Custom test workflow',
          requirements: 'Create a simple test workflow that logs "Hello, World!"',
          projectPath: PROJECT_PATH,
        },
        runtimeContext,
      });
      console.log(JSON.stringify(customResult, null, 2));
      break;

    default:
      console.log('Available tests: 1 (discovery), 2 (simple create), 3 (custom)');
      console.log('Usage: bun test-workflow-builder.ts [test-number]');
      console.log('Or run without arguments for full test suite');
  }
}

if (testNumber) {
  runSpecificTest(testNumber).catch(console.error);
} else {
  main().catch(console.error);
}
