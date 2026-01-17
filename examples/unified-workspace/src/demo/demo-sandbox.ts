/**
 * Sandbox Demo
 *
 * Demonstrates the Sandbox API within Workspace:
 * - Execute code (Node.js, Python, Bash)
 * - Execute commands
 * - Install packages
 *
 * Run with: pnpm demo:sandbox
 */

import { globalWorkspace } from '../mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('SANDBOX DEMO');
  console.log('='.repeat(70));
  console.log();

  // Initialize workspace
  console.log('Initializing workspace...');
  await globalWorkspace.init();
  console.log();

  // Check if sandbox is available
  if (!globalWorkspace.sandbox) {
    console.log('Sandbox is not configured in this workspace.');
    console.log('Add a sandbox provider to enable code execution:');
    console.log();
    console.log('  import { LocalSandbox } from "@mastra/core/workspace";');
    console.log();
    console.log('  const workspace = new Workspace({');
    console.log('    filesystem: new LocalFilesystem({ basePath: "./data" }),');
    console.log('    sandbox: new LocalSandbox({ workingDirectory: "./data" }),');
    console.log('  });');
    console.log();
    return;
  }

  // =========================================================================
  // PART 1: Sandbox Info
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: SANDBOX INFO');
  console.log('='.repeat(70));
  console.log();

  console.log('Sandbox capabilities:');
  console.log(`  Provider: ${globalWorkspace.sandbox.constructor.name}`);
  console.log();

  // =========================================================================
  // PART 2: Execute Code - Node.js
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: EXECUTE CODE - NODE.JS');
  console.log('='.repeat(70));
  console.log();

  // Simple console.log
  console.log('Running: console.log("Hello from Node.js!")');
  try {
    const result1 = await globalWorkspace.executeCode('console.log("Hello from Node.js!");', {
      runtime: 'node',
    });
    console.log(`  Exit code: ${result1.exitCode}`);
    console.log(`  stdout: ${result1.stdout.trim()}`);
    if (result1.stderr) console.log(`  stderr: ${result1.stderr.trim()}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // Math calculation
  console.log('Running: Math calculation');
  try {
    const result2 = await globalWorkspace.executeCode(
      `
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
const avg = sum / numbers.length;
console.log("Sum:", sum);
console.log("Average:", avg);
    `.trim(),
      { runtime: 'node' },
    );
    console.log(`  Exit code: ${result2.exitCode}`);
    console.log(`  Output:`);
    for (const line of result2.stdout.trim().split('\n')) {
      console.log(`    ${line}`);
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // JSON processing
  console.log('Running: JSON processing');
  try {
    const result3 = await globalWorkspace.executeCode(
      `
const data = { name: "Mastra", version: "1.0", features: ["agents", "workflows", "workspace"] };
console.log("Name:", data.name);
console.log("Features:", data.features.join(", "));
    `.trim(),
      { runtime: 'node' },
    );
    console.log(`  Exit code: ${result3.exitCode}`);
    console.log(`  Output:`);
    for (const line of result3.stdout.trim().split('\n')) {
      console.log(`    ${line}`);
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 3: Execute Code - Python
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: EXECUTE CODE - PYTHON');
  console.log('='.repeat(70));
  console.log();

  console.log('Running: print("Hello from Python!")');
  try {
    const result4 = await globalWorkspace.executeCode('print("Hello from Python!")', {
      runtime: 'python',
    });
    console.log(`  Exit code: ${result4.exitCode}`);
    console.log(`  stdout: ${result4.stdout.trim()}`);
    if (result4.stderr) console.log(`  stderr: ${result4.stderr.trim()}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('Running: Python list comprehension');
  try {
    const result5 = await globalWorkspace.executeCode(
      `
numbers = [1, 2, 3, 4, 5]
squares = [n ** 2 for n in numbers]
print("Numbers:", numbers)
print("Squares:", squares)
    `.trim(),
      { runtime: 'python' },
    );
    console.log(`  Exit code: ${result5.exitCode}`);
    console.log(`  Output:`);
    for (const line of result5.stdout.trim().split('\n')) {
      console.log(`    ${line}`);
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 4: Execute Code - Bash
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 4: EXECUTE CODE - BASH');
  console.log('='.repeat(70));
  console.log();

  console.log('Running: echo "Hello from Bash!"');
  try {
    const result6 = await globalWorkspace.executeCode('echo "Hello from Bash!"', {
      runtime: 'bash',
    });
    console.log(`  Exit code: ${result6.exitCode}`);
    console.log(`  stdout: ${result6.stdout.trim()}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('Running: Bash script with variables');
  try {
    const result7 = await globalWorkspace.executeCode(
      `
NAME="Mastra"
VERSION="1.0"
echo "Project: $NAME"
echo "Version: $VERSION"
echo "Date: $(date +%Y-%m-%d)"
    `.trim(),
      { runtime: 'bash' },
    );
    console.log(`  Exit code: ${result7.exitCode}`);
    console.log(`  Output:`);
    for (const line of result7.stdout.trim().split('\n')) {
      console.log(`    ${line}`);
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 5: Execute Command
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 5: EXECUTE COMMAND');
  console.log('='.repeat(70));
  console.log();

  console.log('Running: ls -la (list files)');
  try {
    const result8 = await globalWorkspace.executeCommand('ls', ['-la']);
    console.log(`  Exit code: ${result8.exitCode}`);
    console.log(`  Output (first 5 lines):`);
    const lines = result8.stdout.trim().split('\n').slice(0, 5);
    for (const line of lines) {
      console.log(`    ${line}`);
    }
    console.log('    ...');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('Running: pwd (print working directory)');
  try {
    const result9 = await globalWorkspace.executeCommand('pwd');
    console.log(`  Exit code: ${result9.exitCode}`);
    console.log(`  Output: ${result9.stdout.trim()}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('Running: node --version');
  try {
    const result10 = await globalWorkspace.executeCommand('node', ['--version']);
    console.log(`  Exit code: ${result10.exitCode}`);
    console.log(`  Output: ${result10.stdout.trim()}`);
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 6: Install Package
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 6: INSTALL PACKAGE');
  console.log('='.repeat(70));
  console.log();

  console.log('Note: installPackage() runs package manager commands (npm, pip, etc.)');
  console.log('Skipping actual install to avoid modifying the environment.');
  console.log();

  console.log('Example usage:');
  console.log('  await workspace.sandbox.installPackage("lodash", { manager: "npm" });');
  console.log('  await workspace.sandbox.installPackage("requests", { manager: "pip" });');
  console.log();

  // Demonstrate that the method exists
  if (globalWorkspace.sandbox && 'installPackage' in globalWorkspace.sandbox) {
    console.log('  installPackage() method: Available');
  } else {
    console.log('  installPackage() method: Not available on this sandbox');
  }
  console.log();

  // =========================================================================
  // PART 7: Error Handling
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 7: ERROR HANDLING');
  console.log('='.repeat(70));
  console.log();

  console.log('Running: Code with syntax error');
  try {
    const result11 = await globalWorkspace.executeCode('console.log("unclosed string)', {
      runtime: 'node',
    });
    console.log(`  Exit code: ${result11.exitCode}`);
    if (result11.stderr) {
      console.log(`  Error output (truncated):`);
      const errorLines = result11.stderr.trim().split('\n').slice(0, 3);
      for (const line of errorLines) {
        console.log(`    ${line.slice(0, 70)}`);
      }
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  console.log('Running: Code that throws');
  try {
    const result12 = await globalWorkspace.executeCode('throw new Error("Intentional error")', {
      runtime: 'node',
    });
    console.log(`  Exit code: ${result12.exitCode}`);
    if (result12.stderr) {
      console.log(`  Error output (truncated):`);
      const errorLines = result12.stderr.trim().split('\n').slice(0, 2);
      for (const line of errorLines) {
        console.log(`    ${line.slice(0, 70)}`);
      }
    }
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Sandbox API features demonstrated:');
  console.log('  - executeCode(): Run code in Node.js, Python, Bash');
  console.log('  - executeCommand(): Run shell commands');
  console.log('  - installPackage(): Install packages via npm, pip, etc.');
  console.log('  - Error handling for failed executions');
  console.log();
  console.log('Supported runtimes:');
  console.log('  - node: JavaScript/TypeScript execution');
  console.log('  - python: Python script execution');
  console.log('  - bash: Shell script execution');
  console.log('  - ruby: Ruby script execution (if available)');
  console.log();
  console.log('Agent tools (when sandbox is configured):');
  console.log('  - workspace_execute_code');
  console.log('  - workspace_execute_command');
  console.log('  - workspace_install_package');
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
