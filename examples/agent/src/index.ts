import { z } from 'zod';
import { mastra } from './mastra/index';

/**
 * Comprehensive validation tests for all Mastra primitives
 * Testing get(key), getById(id), and list() for each primitive
 */

// Helper function to log test results
function logTestResult(testName: string, success: boolean, details?: any) {
  const emoji = success ? '✅' : '❌';
  console.log(`\n${emoji} ${testName}:`, details || '');
}

// Helper function to safely test a method
async function testMethod(methodName: string, fn: () => any, shouldSucceed = true) {
  try {
    const result = await fn();
    logTestResult(
      methodName,
      shouldSucceed,
      result
        ? `Found: ${JSON.stringify(result.id || result.name || 'object', null, 2).substring(0, 100)}...`
        : 'Result obtained',
    );
    return { success: shouldSucceed, result };
  } catch (error: any) {
    logTestResult(methodName, !shouldSucceed, `Error: ${error.message}`);
    return { success: !shouldSucceed, error };
  }
}

async function validateAllPrimitives() {
  console.log('🚀 Starting Mastra Primitives Validation Tests\n');
  console.log('='.repeat(80));

  // ============================
  // 1. AGENTS
  // ============================
  console.log('\n📋 TESTING AGENTS');
  console.log('-'.repeat(40));

  // Test getAgent (by key)
  await testMethod('Agent: getAgent("chefAgent")', () => {
    const agent = mastra.getAgent('chefAgent');
    return { id: agent.id, name: agent.name };
  });

  await testMethod(
    'Agent: getAgent("nonExistentAgent")',
    () => {
      return mastra.getAgent('nonExistentAgent' as any);
    },
    false,
  );

  // Test getAgentById
  await testMethod('Agent: getAgentById() with valid ID', () => {
    const agent = mastra.getAgent('chefAgent');
    const agentById = mastra.getAgentById(agent.id);
    return { id: agentById.id, name: agentById.name };
  });

  await testMethod(
    'Agent: getAgentById("nonExistentId")',
    () => {
      return mastra.getAgentById('nonExistentId');
    },
    false,
  );

  // Test listAgents
  await testMethod('Agent: listAgents()', () => {
    const agents = mastra.listAgents();
    const agentNames = Object.keys(agents);
    return { count: agentNames.length, names: agentNames };
  });

  // ============================
  // 2. WORKFLOWS
  // ============================
  console.log('\n📋 TESTING WORKFLOWS');
  console.log('-'.repeat(40));

  // Test getWorkflow (by key)
  await testMethod('Workflow: getWorkflow("myWorkflow")', () => {
    const workflow = mastra.getWorkflow('myWorkflow');
    return { id: workflow.id, name: workflow.name };
  });

  await testMethod(
    'Workflow: getWorkflow("nonExistentWorkflow")',
    () => {
      return mastra.getWorkflow('nonExistentWorkflow' as any);
    },
    false,
  );

  // Test getWorkflowById
  await testMethod('Workflow: getWorkflowById() with valid ID', () => {
    const workflow = mastra.getWorkflow('myWorkflow');
    const workflowById = mastra.getWorkflowById(workflow.id);
    return { id: workflowById.id, name: workflowById.name };
  });

  await testMethod(
    'Workflow: getWorkflowById("nonExistentId")',
    () => {
      return mastra.getWorkflowById('nonExistentId');
    },
    false,
  );

  // Test listWorkflows
  await testMethod('Workflow: listWorkflows()', () => {
    const workflows = mastra.listWorkflows();
    const workflowNames = Object.keys(workflows);
    return { count: workflowNames.length, names: workflowNames };
  });

  // ============================
  // 3. SCORERS
  // ============================
  console.log('\n📋 TESTING SCORERS');
  console.log('-'.repeat(40));

  // Test getScorer (by key)
  await testMethod('Scorer: getScorer("testScorer")', () => {
    const scorer = mastra.getScorer('testScorer');
    return { id: scorer.id, name: scorer.name };
  });

  await testMethod(
    'Scorer: getScorer("nonExistentScorer")',
    () => {
      return mastra.getScorer('nonExistentScorer' as any);
    },
    false,
  );

  // Test getScorerById
  await testMethod('Scorer: getScorerById() with valid ID', () => {
    const scorer = mastra.getScorer('testScorer');
    const scorerById = mastra.getScorerById(scorer.id);
    return { id: scorerById.id, name: scorerById.name };
  });

  await testMethod(
    'Scorer: getScorerById("nonExistentId")',
    () => {
      return mastra.getScorerById('nonExistentId');
    },
    false,
  );

  // Test listScorers
  await testMethod('Scorer: listScorers()', () => {
    const scorers = mastra.listScorers();
    const scorerNames = Object.keys(scorers);
    return { count: scorerNames.length, names: scorerNames };
  });

  // ============================
  // 4. MCP SERVERS
  // ============================
  console.log('\n📋 TESTING MCP SERVERS');
  console.log('-'.repeat(40));

  // Test getMCPServer (by key)
  await testMethod('MCPServer: getMCPServer("myMcpServer")', () => {
    const server = mastra.getMCPServer('myMcpServer');
    return { id: server.id };
  });

  await testMethod(
    'MCPServer: getMCPServer("nonExistentServer")',
    () => {
      return mastra.getMCPServer('nonExistentServer' as any);
    },
    false,
  );

  // Test getMCPServerById
  await testMethod('MCPServer: getMCPServerById() with valid ID', () => {
    const server = mastra.getMCPServer('myMcpServer');
    const serverById = mastra.getMCPServerById(server.id);
    return { found: serverById !== undefined, id: serverById?.id };
  });

  await testMethod('MCPServer: getMCPServerById("nonExistentId")', () => {
    const serverById = mastra.getMCPServerById('nonExistentId');
    return { found: serverById !== undefined };
  });

  // Test listMCPServers
  await testMethod('MCPServer: listMCPServers()', () => {
    const servers = mastra.listMCPServers();
    const serverNames = servers ? Object.keys(servers) : [];
    return { count: serverNames.length, names: serverNames };
  });

  // ============================
  // 5. VECTORS
  // ============================
  console.log('\n📋 TESTING VECTORS');
  console.log('-'.repeat(40));

  // Test getVector (by key) - Note: No vectors configured in this example
  await testMethod(
    'Vector: getVector("anyVector")',
    () => {
      return mastra.getVector('anyVector' as any);
    },
    false,
  );

  // Test getVectorById - Note: No vectors configured in this example
  await testMethod(
    'Vector: getVectorById("vector-id")',
    () => {
      return mastra.getVectorById('vector-id');
    },
    false,
  );

  // Test listVectors
  await testMethod('Vector: listVectors()', () => {
    const vectors = mastra.listVectors();
    const vectorNames = vectors ? Object.keys(vectors) : [];
    return { count: vectorNames.length, names: vectorNames };
  });

  // ============================
  // 6. TOOLS
  // ============================
  console.log('\n📋 TESTING TOOLS');
  console.log('-'.repeat(40));

  // Test getTool (by key) - Note: No tools configured in this example
  await testMethod(
    'Tool: getTool("anyTool")',
    () => {
      return mastra.getTool('anyTool' as any);
    },
    false,
  );

  // Test getToolById - Note: No tools configured in this example
  await testMethod(
    'Tool: getToolById("tool-id")',
    () => {
      return mastra.getToolById('tool-id');
    },
    false,
  );

  // Test listTools
  await testMethod('Tool: listTools()', () => {
    const tools = mastra.listTools();
    const toolNames = tools ? Object.keys(tools) : [];
    return { count: toolNames.length, names: toolNames };
  });

  // ============================
  // 7. PROCESSORS
  // ============================
  console.log('\n📋 TESTING PROCESSORS');
  console.log('-'.repeat(40));

  // Test getProcessor (by key) - Note: No processors configured in this example
  await testMethod(
    'Processor: getProcessor("anyProcessor")',
    () => {
      return mastra.getProcessor('anyProcessor' as any);
    },
    false,
  );

  // Test getProcessorById - Note: No processors configured in this example
  await testMethod(
    'Processor: getProcessorById("processor-id")',
    () => {
      return mastra.getProcessorById('processor-id');
    },
    false,
  );

  // Test listProcessors
  await testMethod('Processor: listProcessors()', () => {
    const processors = mastra.listProcessors();
    const processorNames = processors ? Object.keys(processors) : [];
    return { count: processorNames.length, names: processorNames };
  });

  // ============================
  // SUMMARY
  // ============================
  console.log('\n' + '='.repeat(80));
  console.log('🎉 VALIDATION COMPLETE!');
  console.log('='.repeat(80));

  console.log('\n📊 Summary of Primitives:');

  const agents = mastra.listAgents();
  console.log(`  • Agents (${Object.keys(agents).length}):`, Object.keys(agents).join(', '));

  const workflows = mastra.listWorkflows();
  console.log(`  • Workflows (${Object.keys(workflows).length}):`, Object.keys(workflows).join(', '));

  const scorers = mastra.listScorers();
  console.log(`  • Scorers (${Object.keys(scorers!).length}):`, Object.keys(scorers!).join(', '));

  const mcpServers = mastra.listMCPServers();
  if (mcpServers) {
    console.log(`  • MCP Servers (${Object.keys(mcpServers).length}):`, Object.keys(mcpServers).join(', '));
  } else {
    console.log(`  • MCP Servers (0): none configured`);
  }

  const vectors = mastra.listVectors();
  if (vectors) {
    console.log(`  • Vectors (${Object.keys(vectors).length}):`, Object.keys(vectors).join(', '));
  } else {
    console.log(`  • Vectors (0): none configured`);
  }

  const tools = mastra.listTools();
  if (tools) {
    console.log(`  • Tools (${Object.keys(tools).length}):`, Object.keys(tools).join(', '));
  } else {
    console.log(`  • Tools (0): none configured`);
  }

  const processors = mastra.listProcessors();
  if (processors) {
    console.log(`  • Processors (${Object.keys(processors).length}):`, Object.keys(processors).join(', '));
  } else {
    console.log(`  • Processors (0): none configured`);
  }

  console.log('\n✨ All primitive methods validated: get(key), getById(id), list()');
}

// Run the validation
validateAllPrimitives().catch(error => {
  console.error('❌ Fatal error during validation:', error);
  process.exit(1);
});
