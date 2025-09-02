import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Mastra, Agent } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { LibSQLStore } from '@mastra/libsql';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { workflowBuilderWorkflow } from '../../src/workflows';

// Import openai dynamically to handle cases where it might not be available
const openai = (() => {
  try {
    return require('@ai-sdk/openai').openai;
  } catch {
    return null;
  }
})();

function exec(cmd: string, cwd?: string) {
  return execSync(cmd, { stdio: 'pipe', cwd }).toString();
}

function initGitRepo(repoDir: string) {
  exec('git init -q', repoDir);
  exec('git config user.email "test@example.com"', repoDir);
  exec('git config user.name "Test User"', repoDir);
}

function commitAll(repoDir: string, message: string) {
  exec('git add .', repoDir);
  exec(`git commit -m "${message}" -q`, repoDir);
}

describe('Workflow Builder Integration Tests', () => {
  const integrationProjectsDir = resolve(__dirname, '../integration-projects');
  mkdirSync(integrationProjectsDir, { recursive: true });
  const tempRoot = mkdtempSync(join(integrationProjectsDir, 'workflow-builder-test-'));
  const fixtureProjectPath = resolve(__dirname, 'fixtures/minimal-mastra-project');
  const targetRepo = join(tempRoot, 'test-project');

  beforeAll(async () => {
    // Note: For now, skipping storage setup to focus on basic workflow functionality
    new Mastra({
      workflows: {
        workflowBuilderWorkflow,
      },
      logger: false,
      storage: new LibSQLStore({
        url: 'file:mastra.db',
      }),
    });

    // Copy the fixture mastra project into temp directory
    mkdirSync(targetRepo, { recursive: true });
    cpSync(fixtureProjectPath, targetRepo, { recursive: true });

    // Initialize git in target
    initGitRepo(targetRepo);
    commitAll(targetRepo, 'chore: initial mastra project');
  });

  afterAll(() => {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  });

  it('should handle workflow builder with suspend/resume flow for email workflow', async () => {
    // Skip test if no OPENAI_API_KEY available or openai not available
    if (!process.env.OPENAI_API_KEY || !openai) {
      console.log('Skipping test: OPENAI_API_KEY not set or @ai-sdk/openai not available');
      return;
    }

    // Create an agent that will answer questions during the workflow
    const questionAnsweringAgent = new Agent({
      name: 'question-answering-agent',
      model: openai('gpt-4o-mini'),
      instructions: `You are an assistant that answers technical questions about workflow creation. 
      
      When asked about email providers, always respond with "sendgrid".
      When asked about configuration details, provide reasonable defaults.
      When asked about error handling approaches, suggest try-catch blocks.
      Keep responses concise and focused.`,
    });

    const runtimeContext = new RuntimeContext();

    const run = await workflowBuilderWorkflow.createRunAsync();

    const inputData = {
      workflowName: 'send_email_workflow',
      action: 'create' as const,
      description: 'A workflow to send an email to a specified recipient with a subject and message body.',
      requirements:
        'The workflow should accept recipient email address, subject, and message body as inputs. It should use an email sending service or SMTP configuration to send the email. Include error handling for failed email delivery.',
      projectPath: targetRepo,
    };

    console.log('Input data:', JSON.stringify(inputData, null, 2));

    const { stream, getWorkflowState } = run.stream({
      inputData,
      runtimeContext,
    });

    let suspensionCount = 0;
    const maxSuspensions = 5; // Prevent infinite loops

    for await (const data of stream) {
      console.log(`Stream event: ${data.type}`);

      if (data.type === 'step-suspended') {
        suspensionCount++;
        console.log(`Workflow suspended (${suspensionCount}/${maxSuspensions})`);

        if (suspensionCount > maxSuspensions) {
          throw new Error('Too many suspensions - possible infinite loop');
        }

        // The suspension data is in data.payload.suspendPayload
        const suspendPayload = data.payload?.suspendPayload;
        const suspendedStepId = data.payload?.id;
        console.log('Suspend payload:', JSON.stringify(suspendPayload, null, 2));
        console.log('Suspended step ID:', suspendedStepId);
        console.log('Current run ID:', run.runId);

        // Check if we have questions to answer
        if (suspendPayload?.questions && Array.isArray(suspendPayload.questions)) {
          console.log(`Found ${suspendPayload.questions.length} questions to answer`);

          const answers: Record<string, string> = {};

          // Use the agent to answer each question
          for (const question of suspendPayload.questions) {
            console.log(`Answering question: ${question.question}`);

            let prompt = `Question: ${question.question}`;

            if (question.type === 'choice' && question.options) {
              prompt += `\n\nOptions: ${question.options.join(', ')}`;
              prompt += `\n\nPlease respond with exactly one of the provided options.`;
            }

            if (question.context) {
              prompt += `\n\nContext: ${question.context}`;
            }

            const response = await questionAnsweringAgent.generate(prompt);
            const answer = response.text.trim();

            console.log(`Answer: ${answer}`);
            answers[question.id] = answer;
          }

          // Resume the workflow with the answers (following playground UI pattern)
          console.log('Resuming workflow with answers:', answers);

          setImmediate(async () => {
            try {
              // Split step ID for nested workflows (like playground does)
              const stepIds = suspendedStepId ? suspendedStepId.split('.') : [];
              console.log('Step IDs for resume:', stepIds);
              console.log('Attempting to resume with existing run ID:', run.runId);

              // Resume using the current run (the correct approach for direct workflow API)
              await run.resume({
                resumeData: { answers },
                step: stepIds.length > 1 ? stepIds : suspendedStepId,
              });

              console.log('Resume initiated successfully');
            } catch (error) {
              console.error('Resume failed:', error);
              // Log more details about the error
              console.error('Error details:', JSON.stringify(error, null, 2));
            }
          });
        } else if (suspendPayload?.message) {
          // Handle task approval step
          console.log('Task approval step - approving the task list');
          setImmediate(async () => {
            try {
              // Split step ID for nested workflows (like playground does)
              const stepIds = suspendedStepId ? suspendedStepId.split('.') : [];
              console.log('Task approval step IDs for resume:', stepIds);
              console.log('Attempting task approval resume with existing run ID:', run.runId);

              // Resume with approval using the current run
              await run.resume({
                resumeData: { approved: true },
                step: stepIds.length > 1 ? stepIds : suspendedStepId,
              });

              console.log('Task approval resume initiated successfully');
            } catch (error) {
              console.error('Task approval resume failed:', error);
              console.error('Task approval error details:', JSON.stringify(error, null, 2));
            }
          });
        } else {
          throw new Error('Suspended step has no questions or approval message');
        }
      }

      if (data.type === 'step-result') {
        console.log(`Step ${data.payload.id} completed successfully`);
      }

      if (data.type === 'error') {
        console.error(`Step failed:`, data.error);
        throw new Error(`Step failed: ${data.error}`);
      }
    }

    // Get the final workflow state
    const finalState = await getWorkflowState();
    console.log('Final workflow state:', JSON.stringify(finalState, null, 2));

    // Verify the workflow completed successfully
    expect(finalState.status).toBe('success');

    // Check if workflow files were created
    const workflowsDir = join(targetRepo, 'src/mastra/workflows');
    const workflowFile = join(workflowsDir, 'send-email-workflow/workflow.ts');

    console.log('Checking for workflow file at:', workflowFile);
    expect(existsSync(workflowFile)).toBe(true);

    // Verify that the workflow was properly registered
    const indexFile = join(workflowsDir, 'index.ts');
    if (existsSync(indexFile)) {
      const indexContent = exec(`cat "${indexFile}"`);
      expect(indexContent).toContain('sendEmailWorkflow');
    }

    console.log('Workflow builder integration test completed successfully');
  }, 600000);
});
