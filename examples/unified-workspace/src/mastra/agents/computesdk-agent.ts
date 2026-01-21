// import { Agent } from '@mastra/core/agent';
// import { ComputeSDKSandbox, ComputeSDKFilesystem } from '../computesdk-sandbox';
// import { Workspace } from '@mastra/core';
// import { Memory } from '@mastra/memory';
// import { LibSQLStore } from '@mastra/libsql';
// import { compute } from 'computesdk';

// const sandbox = await compute.sandbox.findOrCreate({
//   name: 'unified-workspace-sandbox',
//   timeout: 60_000,
//   // envs: {},
// });

// const workspaceSandbox = new ComputeSDKSandbox({
//   name: 'unified-workspace-sandbox',
//   namespace: 'mastra-examples',
//   timeout: 60_000,
//   runtimes: ['node', 'python', 'bash'],
//   sandbox,
// });

// const filesystem = new ComputeSDKFilesystem({
//   workspaceSandbox: workspaceSandbox,
// });

// export const computesdkWorkspace = new Workspace({
//   id: 'computesdk-workspace',
//   name: 'ComputeSDK Workspace',
//   filesystem,
//   sandbox: workspaceSandbox,
//   skillsPaths: ['skills'],
// });

// const storage = new LibSQLStore({
//   id: 'computesdk-agent-storage',
//   url: `file:${process.env.MASTRA_DB_PATH}/mastra.db`,
// });

// const memory = new Memory({
//   storage,
// });

// /**
//  * ComputeSDK agent - executes code in cloud sandboxes via ComputeSDK.
//  *
//  * ComputeSDK is a unified API for cloud sandboxes (E2B, Modal, etc.)
//  *
//  * Requirements:
//  * - Install computesdk: npm install computesdk
//  * - Set COMPUTESDK_API_KEY environment variable
//  * - Set provider credentials (e.g., E2B_API_KEY)
//  */
// export const computesdkAgent = new Agent({
//   id: 'computesdk-agent',
//   name: 'ComputeSDK Agent',
//   description: 'An agent that executes code via ComputeSDK unified sandbox API.',
//   instructions: `You are a cloud code execution assistant.

// Your job is to help run code securely in isolated cloud sandboxes.

// Key capabilities:
// 1. Execute Python code for data analysis and scripting
// 2. Execute Node.js code for JavaScript/TypeScript tasks
// 3. Run bash commands for system operations
// 4. Install packages in the sandbox environment
// 5. Read and write files in the cloud sandbox filesystem

// Benefits of cloud sandboxes:
// - Code runs in isolated environments (not on the user's machine)
// - Named sandboxes persist state across executions
// - Multiple runtime support (Python, Node.js, Bash)
// - Secure execution of untrusted code
// - Unified filesystem - files written are visible to code and vice versa

// When running code:
// 1. Choose the appropriate runtime (python, node, or bash)
// 2. Use execute_code for running code snippets
// 3. Use execute_command for shell commands
// 4. Use workspace file tools to read/write files in the sandbox
// 5. Report output and any errors clearly

// Use workspace sandbox tools to execute code in the cloud.`,

//   model: 'openai/gpt-4o',
//   workspace: computesdkWorkspace,
//   memory,
// });
