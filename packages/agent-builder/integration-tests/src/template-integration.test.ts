import type { ChildProcess } from 'node:child_process';
import { spawn, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, cpSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Mastra } from '@mastra/core';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { fetchMastraTemplates } from '../../src/utils';
import { agentBuilderTemplateWorkflow } from '../../src/workflows';

function exec(cmd: string, cwd?: string): string {
  return execSync(cmd, { stdio: 'pipe', cwd, encoding: 'utf-8' });
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

describe('Template Workflow Integration Tests', () => {
  const integrationProjectsDir = resolve(__dirname, '../integration-projects');
  mkdirSync(integrationProjectsDir, { recursive: true });
  const tempRoot = mkdtempSync(join(integrationProjectsDir, 'template-workflow-test-'));
  const fixtureProjectPath = resolve(__dirname, 'fixtures/minimal-mastra-project');
  const targetRepo = join(tempRoot, 'test-project');
  let mastraServer: ChildProcess;
  let port = 4199;
  let mastraInstance: Mastra;

  beforeAll(async () => {
    mastraInstance = new Mastra({
      workflows: {
        agentBuilderTemplateWorkflow,
      },
    });

    // Copy the fixture mastra project into temp directory
    mkdirSync(targetRepo, { recursive: true });
    cpSync(fixtureProjectPath, targetRepo, { recursive: true });

    // Initialize git in target
    initGitRepo(targetRepo);

    // Verify .gitignore was copied
    const gitignorePath = join(targetRepo, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);

    commitAll(targetRepo, 'chore: initial mastra project');

    // Install dependencies in the test project
    console.log('Installing dependencies in test project...');
    exec('pnpm install', targetRepo);
  });

  afterAll(async () => {
    // Kill the Mastra server if it's running
    if (mastraServer?.pid) {
      try {
        process.kill(-mastraServer.pid, 'SIGTERM');
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn('Failed to kill Mastra server:', e);
      }
    }

    // Cleanup temp directory
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should merge csv-to-questions template and validate functionality', async () => {
    // Skip test if no OPENAI_API_KEY available
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    // Get the csv-to-questions template info
    const templates = await fetchMastraTemplates();
    const csvTemplate = templates.find(t => t.slug === 'csv-to-questions');
    expect(csvTemplate).toBeDefined();

    console.log(`Starting template merge workflow in ${targetRepo}`);

    const templateWorkflow = mastraInstance.getWorkflow(`agentBuilderTemplateWorkflow`);

    // Run the merge template workflow
    const workflowRun = await templateWorkflow.createRunAsync();
    const result = await workflowRun.start({
      inputData: {
        repo: csvTemplate!.githubUrl,
        slug: 'csv-to-questions',
        targetPath: targetRepo,
      },
    });

    console.log('Workflow result:', JSON.stringify(result, null, 2));

    // Verify the workflow succeeded
    expect(result).toBeDefined();
    expect(result.status).toBe('success');
    expect(result.result?.success).toBe(true);
    expect(result.result?.applied).toBe(true);
    expect(result.result?.branchName).toBe('feat/install-template-csv-to-questions');

    // Verify the template branch was created
    const branches = exec('git branch', targetRepo);
    expect(branches).toContain('feat/install-template-csv-to-questions');

    // Verify expected template files were created
    const expectedPaths = [
      'src/mastra/agents/csvQuestionAgent.ts',
      'src/mastra/tools/csvFetcherTool.ts',
      'src/mastra/workflows/csvToQuestionsWorkflow.ts',
    ];

    for (const expectedPath of expectedPaths) {
      const fullPath = join(targetRepo, expectedPath);
      expect(existsSync(fullPath), `Expected ${expectedPath} to exist`).toBe(true);
    }

    // Verify package.json was updated
    const packageJsonPath = join(targetRepo, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.scripts).toBeDefined();

    // Check for template-specific scripts or dependencies
    const hasTemplateScript = Object.keys(packageJson.scripts || {}).some(
      key => key.includes('csv-to-questions') || key.includes('template'),
    );
    expect(hasTemplateScript).toBe(true);

    console.log('Template merge completed successfully');
  }, 600000); // 10 minute timeout for full workflow

  it('should start Mastra server and validate both original and new agents work', async () => {
    // Skip test if no OPENAI_API_KEY available
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    console.log('Starting Mastra server...');

    // Start the Mastra server
    mastraServer = spawn('pnpm', ['dev'], {
      stdio: 'pipe',
      cwd: targetRepo,
      detached: true,
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Mastra server failed to start within timeout'));
      }, 600000);

      mastraServer.stdout?.on('data', data => {
        output += data.toString();
        console.log('Server output:', data.toString());
        if (output.includes('http://localhost:') || output.includes(`localhost:${port}`)) {
          clearTimeout(timeout);
          resolve();
        }
      });

      mastraServer.stderr?.on('data', data => {
        const errorStr = data.toString();
        console.error('Mastra server error:', errorStr);
        // Don't reject on warnings, only on actual errors
        if (errorStr.toLowerCase().includes('error') && !errorStr.toLowerCase().includes('warning')) {
          clearTimeout(timeout);
          reject(new Error(`Mastra server error: ${errorStr}`));
        }
      });

      mastraServer.on('exit', code => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Mastra server exited with code ${code}`));
        }
      });
    });

    console.log(`Mastra server started on port ${port}`);

    // Test the original weather agent (from fixture)
    console.log('Testing original weather agent...');
    const weatherResponse = await fetch(`http://localhost:${port}/api/agents/weatherAgent/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
        threadId: randomUUID(),
        resourceId: 'test-resource',
      }),
    });

    expect(weatherResponse.ok).toBe(true);
    const weatherResult = await weatherResponse.json();
    expect(weatherResult).toBeDefined();
    expect(weatherResult.text || weatherResult.content).toContain('weather');

    // Test the new CSV agent (from template)
    console.log('Testing new CSV agent...');
    const csvResponse = await fetch(`http://localhost:${port}/api/agents/csvQuestionAgent/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'I want to analyze a CSV file with sales data. Can you help me?',
          },
        ],
        threadId: randomUUID(),
        resourceId: 'test-resource',
      }),
    });

    expect(csvResponse.ok).toBe(true);
    const csvResult = await csvResponse.json();
    expect(csvResult).toBeDefined();
    expect(csvResult.text || csvResult.content).toMatch(/csv|data|analyze/i);

    // Test workflows endpoint to ensure new workflow is registered
    console.log('Testing workflows endpoint...');
    const workflowsResponse = await fetch(`http://localhost:${port}/api/workflows`);
    expect(workflowsResponse.ok).toBe(true);
    const workflows = await workflowsResponse.json();
    expect(workflows).toBeDefined();

    // Check if the CSV workflow is registered (workflows is an object, not array)
    const hasCSVWorkflow =
      workflows &&
      ('csvToQuestionsWorkflow' in workflows || Object.values(workflows).some((w: any) => w.name?.includes('csv')));
    expect(hasCSVWorkflow).toBe(true);

    console.log('All agent and workflow tests passed!');
  }, 600000); // 10 minute timeout for server startup and testing

  it('should validate git history shows proper template integration', async () => {
    // Check git log for template commits
    const gitLog = exec('git log --oneline', targetRepo);
    expect(gitLog).toContain('feat(template): register components from csv-to-questions@');
    expect(gitLog).toContain('feat(template): copy 6 files from csv-to-questions@');
    expect(gitLog).toContain('fix(template): resolve validation errors for csv-to-questions@');

    // Verify we're on the template branch
    const currentBranch = exec('git branch --show-current', targetRepo);
    expect(currentBranch.trim()).toBe('feat/install-template-csv-to-questions');

    // Verify the original default branch still exists
    const allBranches = exec('git branch', targetRepo);
    expect(allBranches).toMatch(/\b(main|master)\b/);

    console.log('Git history validation completed');
  });

  it('should handle merge conflicts gracefully when running workflow twice', async () => {
    // Skip test if no OPENAI_API_KEY available
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping test: OPENAI_API_KEY not set');
      return;
    }

    // Switch back to default branch
    const defaultBranch = exec('git branch', targetRepo).includes('main') ? 'main' : 'master';
    exec(`git checkout ${defaultBranch}`, targetRepo);

    // Try to merge the same template again (should handle gracefully)
    const templates = await fetchMastraTemplates();
    const csvTemplate = templates.find(t => t.slug === 'csv-to-questions');

    console.log('Testing duplicate template merge...');

    const templateWorkflow = mastraInstance.getWorkflow(`agentBuilderTemplateWorkflow`);
    const workflowRun = await templateWorkflow.createRunAsync();
    const result = await workflowRun.start({
      inputData: {
        repo: csvTemplate!.githubUrl,
        slug: 'csv-to-questions',
        targetPath: targetRepo,
      },
    });

    // The workflow should still succeed but handle the existing files intelligently
    expect(result.status).toBe('success');

    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'success') {
      expect(result.result.success).toBe(true);
      expect(result.result.applied).toBe(true);
      // Should create a new branch with a different name or handle existing branch
      expect(result.result.branchName).toMatch(/feat\/install-template-csv-to-questions/);
    }

    console.log('Duplicate merge test completed');
  }, 600000);
});
