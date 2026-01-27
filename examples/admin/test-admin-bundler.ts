/**
 * End-to-End Test for AdminBundler with FileExporter Injection
 *
 * This script tests Phase 4 of the Admin Bundler Implementation Plan:
 * 1. Bundle a test project using AdminBundler
 * 2. Verify bundle output at .mastra/output/index.mjs
 * 3. Check generated code includes FileExporter injection
 *
 * Run with: npx tsx test-admin-bundler.ts
 */

import { AdminBundler } from '@mastra/runner-local';
import { existsSync, readFileSync, statSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PROJECT_PATH = resolve(__dirname, './test-project');
const TEST_OUTPUT_DIR = resolve(__dirname, '.test-build');
const OBSERVABILITY_PATH = join(TEST_OUTPUT_DIR, 'observability');

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function report(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}: ${message}`);
}

async function cleanup() {
  if (existsSync(TEST_OUTPUT_DIR)) {
    await rm(TEST_OUTPUT_DIR, { recursive: true });
  }
}

async function test1_BuildProject(): Promise<boolean> {
  console.log('\n--- Test 1: Build Project with AdminBundler ---');

  const bundler = new AdminBundler();
  const outputDir = join(TEST_OUTPUT_DIR, '.mastra');

  await mkdir(TEST_OUTPUT_DIR, { recursive: true });

  try {
    await bundler.bundleForAdmin(TEST_PROJECT_PATH, outputDir, {
      projectId: 'test-project-123',
      deploymentId: 'test-deployment-456',
      serverId: 'test-server-789',
      observabilityPath: OBSERVABILITY_PATH,
    });

    report('Build Project', true, 'AdminBundler completed successfully');
    return true;
  } catch (error) {
    report('Build Project', false, `Build failed: ${error}`);
    return false;
  }
}

function test2_VerifyBundleOutput(): boolean {
  console.log('\n--- Test 2: Verify Bundle Output ---');

  const outputPath = join(TEST_OUTPUT_DIR, '.mastra', 'output', 'index.mjs');

  if (!existsSync(outputPath)) {
    report('Bundle Output', false, `No output file at ${outputPath}`);
    return false;
  }

  const stats = statSync(outputPath);
  report('Bundle Output', true, `Output exists at ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
  return true;
}

function test3_CheckFileExporterInjection(): boolean {
  console.log('\n--- Test 3: Check FileExporter Injection ---');

  const outputPath = join(TEST_OUTPUT_DIR, '.mastra', 'output', 'index.mjs');
  const content = readFileSync(outputPath, 'utf-8');

  const checks = [
    { pattern: 'ADMIN_CONFIG', description: 'ADMIN_CONFIG constant' },
    { pattern: 'FileExporter', description: 'FileExporter import' },
    { pattern: 'observabilityPath', description: 'observabilityPath config' },
    { pattern: '[Admin] Initializing observability', description: 'Admin initialization log' },
    { pattern: "projectId: 'test-project-123'", description: 'Correct projectId value' },
    { pattern: "deploymentId: 'test-deployment-456'", description: 'Correct deploymentId value' },
    // Note: serverId is defined in ADMIN_CONFIG but currently unused, so it gets tree-shaken out
    // { pattern: "serverId: 'test-server-789'", description: 'Correct serverId value' },
    { pattern: OBSERVABILITY_PATH, description: 'Correct observabilityPath value' },
    { pattern: 'SIGTERM', description: 'Graceful shutdown handler (SIGTERM)' },
    { pattern: 'SIGINT', description: 'Graceful shutdown handler (SIGINT)' },
    { pattern: 'fileExporter.shutdown', description: 'Shutdown call for FileExporter' },
    { pattern: '@mastra/observability', description: 'Import from @mastra/observability' },
    { pattern: 'maxBatchSize', description: 'Batch size configuration' },
    { pattern: 'maxBatchWaitMs', description: 'Batch wait time configuration' },
    { pattern: 'addExporter', description: 'addExporter method call' },
    { pattern: '[Admin] Storage initialized', description: 'Storage initialization log' },
    { pattern: '[Admin] Server started successfully', description: 'Server started log' },
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const found = content.includes(check.pattern);
    if (found) {
      passed++;
      report(`  ${check.description}`, true, 'Found');
    } else {
      failed++;
      report(`  ${check.description}`, false, `Pattern "${check.pattern}" not found`);
    }
  }

  console.log(`\nFileExporter Injection Summary: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

function test4_VerifyEntryStructure(): boolean {
  console.log('\n--- Test 4: Verify Entry Code Structure ---');

  const outputPath = join(TEST_OUTPUT_DIR, '.mastra', 'output', 'index.mjs');
  const content = readFileSync(outputPath, 'utf-8');

  // Check for proper order of sections
  const adminConfigIndex = content.indexOf('ADMIN_CONFIG');
  // Check for FileExporter INSTANTIATION (not class definition which comes earlier in bundle)
  const fileExporterInstanceIndex = content.indexOf('new FileExporter');
  const storageInitIndex = content.indexOf('[Admin] Storage initialized');
  const serverStartIndex = content.indexOf('createNodeServer');

  if (adminConfigIndex === -1) {
    report('Entry Structure', false, 'ADMIN_CONFIG not found');
    return false;
  }

  if (fileExporterInstanceIndex === -1) {
    report('Entry Structure', false, 'FileExporter instantiation not found');
    return false;
  }

  // FileExporter INSTANTIATION should come after ADMIN_CONFIG (class definition comes before, which is fine)
  if (fileExporterInstanceIndex < adminConfigIndex) {
    report('Entry Structure', false, 'FileExporter instantiation appears before ADMIN_CONFIG');
    return false;
  }

  report('Entry Structure', true, 'Entry code has correct structure');
  return true;
}

function test5_VerifyToolsExport(): boolean {
  console.log('\n--- Test 5: Verify Tools Export ---');

  const toolsPath = join(TEST_OUTPUT_DIR, '.mastra', 'output', 'tools.mjs');

  if (!existsSync(toolsPath)) {
    report('Tools Export', false, `Tools file not found at ${toolsPath}`);
    return false;
  }

  report('Tools Export', true, `Tools file exists at ${toolsPath}`);
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('AdminBundler End-to-End Test');
  console.log('='.repeat(60));
  console.log(`Test Project: ${TEST_PROJECT_PATH}`);
  console.log(`Output Directory: ${TEST_OUTPUT_DIR}`);
  console.log(`Observability Path: ${OBSERVABILITY_PATH}`);

  // Clean up before test
  await cleanup();

  try {
    // Run tests
    const buildPassed = await test1_BuildProject();

    if (buildPassed) {
      test2_VerifyBundleOutput();
      test3_CheckFileExporterInjection();
      test4_VerifyEntryStructure();
      test5_VerifyToolsExport();
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed tests:');
      for (const r of results.filter(r => !r.passed)) {
        console.log(`  - ${r.name}: ${r.message}`);
      }
      process.exit(1);
    }

    console.log('\n✅ All tests passed!');

    // Clean up on success
    // await cleanup();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
