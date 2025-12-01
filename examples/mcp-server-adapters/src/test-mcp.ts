import * as fs from 'node:fs';
import * as path from 'node:path';
import { MCPClient } from '@mastra/mcp';

// MCP server IDs as registered with Mastra (keys from mcpServers config)
const mainServerId = 'main-mcp';
const secondaryServerId = 'secondary-mcp';

// Parse command line arguments
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const PORT = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : 3001;

const BASE_URL = `http://localhost:${PORT}`;

// Auth token for protected endpoints
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';
const authHeaders: Record<string, string> = AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};

// Output file setup
const OUTPUT_DIR = path.join(import.meta.dirname, '..', 'output');
const serverType = PORT === 3001 ? 'hono' : PORT === 3002 ? 'express' : `port-${PORT}`;
const OUTPUT_FILE = path.join(OUTPUT_DIR, `test-results-${serverType}.txt`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Log buffer for writing to file
const logBuffer: string[] = [];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(message);
  logBuffer.push(message);
}

function success(testName: string) {
  results.push({ name: testName, passed: true });
  log(`  ✓ ${testName}`);
}

function fail(testName: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  results.push({ name: testName, passed: false, error: errorMessage });
  log(`  ✗ ${testName}: ${errorMessage}`);
}

function writeOutput() {
  const content = logBuffer.join('\n');
  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  console.log(`\nTest output written to: ${OUTPUT_FILE}`);
}

async function testHealthCheck() {
  log('\n--- Testing Health Check ---');
  try {
    const res = await fetch(BASE_URL);
    const data = (await res.json()) as { status?: string };
    if (data.status === 'ok') {
      success('Health check returns ok');
    } else {
      fail('Health check returns ok', `Expected status 'ok', got '${data.status}'`);
    }
  } catch (error) {
    fail('Health check returns ok', error);
  }
}

async function testHttpTransport() {
  log('\n--- Testing HTTP Transport ---');

  // Test with MCPClient for HTTP transport
  const httpClient = new MCPClient({
    servers: {
      main: {
        url: new URL(`${BASE_URL}/api/mcp/${mainServerId}/mcp`),
        requestInit: { headers: authHeaders },
      },
      secondary: {
        url: new URL(`${BASE_URL}/api/mcp/${secondaryServerId}/mcp`),
        requestInit: { headers: authHeaders },
      },
    },
  });

  try {
    // Test listing tools from main server
    const tools = await httpClient.listTools();
    const mainTools = Object.keys(tools).filter(k => k.startsWith('main_'));
    if (mainTools.length === 3) {
      success('HTTP: List tools from main server (3 tools)');
    } else {
      fail('HTTP: List tools from main server (3 tools)', `Expected 3 tools, got ${mainTools.length}`);
    }

    // Test listing tools from secondary server
    const secondaryTools = Object.keys(tools).filter(k => k.startsWith('secondary_'));
    if (secondaryTools.length === 1) {
      success('HTTP: List tools from secondary server (1 tool)');
    } else {
      fail('HTTP: List tools from secondary server (1 tool)', `Expected 1 tool, got ${secondaryTools.length}`);
    }
  } catch (error) {
    fail('HTTP: List tools', error);
  }

  try {
    // Test executing calculator tool
    const tools = await httpClient.listTools();
    const calculateTool = tools['main_calculate'];
    if (!calculateTool || !calculateTool.execute) {
      throw new Error('Calculator tool not found');
    }
    const result = await calculateTool.execute({ operation: 'multiply', a: 6, b: 7 });
    const output = JSON.parse(result.content[0].text);
    if (output.result === 42) {
      success('HTTP: Execute calculator tool (6 * 7 = 42)');
    } else {
      fail('HTTP: Execute calculator tool (6 * 7 = 42)', `Expected 42, got ${output.result}`);
    }
  } catch (error) {
    fail('HTTP: Execute calculator tool', error);
  }

  try {
    // Test executing weather tool
    const tools = await httpClient.listTools();
    const weatherTool = tools['main_getWeather'];
    if (!weatherTool || !weatherTool.execute) {
      throw new Error('Weather tool not found');
    }
    const result = await weatherTool.execute({ location: 'San Francisco' });
    const output = JSON.parse(result.content[0].text);
    if (output.condition === 'Sunny in San Francisco') {
      success('HTTP: Execute weather tool (San Francisco)');
    } else {
      fail('HTTP: Execute weather tool (San Francisco)', `Unexpected condition: ${output.condition}`);
    }
  } catch (error) {
    fail('HTTP: Execute weather tool', error);
  }

  try {
    // Test executing echo tool
    const tools = await httpClient.listTools();
    const echoTool = tools['main_echo'];
    if (!echoTool || !echoTool.execute) {
      throw new Error('Echo tool not found');
    }
    const result = await echoTool.execute({ message: 'Hello MCP!' });
    const output = JSON.parse(result.content[0].text);
    if (output.echo === 'Hello MCP!') {
      success('HTTP: Execute echo tool');
    } else {
      fail('HTTP: Execute echo tool', `Expected 'Hello MCP!', got '${output.echo}'`);
    }
  } catch (error) {
    fail('HTTP: Execute echo tool', error);
  }

  // Test secondary server's calculator tool
  try {
    const tools = await httpClient.listTools();
    const secondaryCalculateTool = tools['secondary_calculate'];
    if (!secondaryCalculateTool || !secondaryCalculateTool.execute) {
      throw new Error('Secondary calculator tool not found');
    }
    const result = await secondaryCalculateTool.execute({ operation: 'divide', a: 100, b: 4 });
    const output = JSON.parse(result.content[0].text);
    if (output.result === 25) {
      success('HTTP: Execute secondary server calculator tool (100 / 4 = 25)');
    } else {
      fail('HTTP: Execute secondary server calculator tool (100 / 4 = 25)', `Expected 25, got ${output.result}`);
    }
  } catch (error) {
    fail('HTTP: Execute secondary server calculator tool', error);
  }

  await httpClient.disconnect();
}

async function testSseTransport() {
  log('\n--- Testing SSE Transport ---');

  // Test with MCPClient for SSE transport
  const sseClient = new MCPClient({
    servers: {
      main: {
        url: new URL(`${BASE_URL}/api/mcp/${mainServerId}/sse`),
        requestInit: { headers: authHeaders },
      },
    },
  });

  try {
    // Test listing tools via SSE
    const tools = await sseClient.listTools();
    const mainTools = Object.keys(tools).filter(k => k.startsWith('main_'));
    if (mainTools.length === 3) {
      success('SSE: List tools from main server (3 tools)');
    } else {
      fail('SSE: List tools from main server (3 tools)', `Expected 3 tools, got ${mainTools.length}`);
    }
  } catch (error) {
    fail('SSE: List tools', error);
  }

  try {
    // Test executing calculator tool via SSE
    const tools = await sseClient.listTools();
    const calculateTool = tools['main_calculate'];
    if (!calculateTool || !calculateTool.execute) {
      throw new Error('Calculator tool not found');
    }
    const result = await calculateTool.execute({ operation: 'add', a: 100, b: 23 });
    const output = JSON.parse(result.content[0].text);
    if (output.result === 123) {
      success('SSE: Execute calculator tool (100 + 23 = 123)');
    } else {
      fail('SSE: Execute calculator tool (100 + 23 = 123)', `Expected 123, got ${output.result}`);
    }
  } catch (error) {
    fail('SSE: Execute calculator tool', error);
  }

  try {
    // Test executing weather tool via SSE
    const tools = await sseClient.listTools();
    const weatherTool = tools['main_getWeather'];
    if (!weatherTool || !weatherTool.execute) {
      throw new Error('Weather tool not found');
    }
    const result = await weatherTool.execute({ location: 'New York' });
    const output = JSON.parse(result.content[0].text);
    if (output.condition === 'Sunny in New York') {
      success('SSE: Execute weather tool (New York)');
    } else {
      fail('SSE: Execute weather tool (New York)', `Unexpected condition: ${output.condition}`);
    }
  } catch (error) {
    fail('SSE: Execute weather tool', error);
  }

  await sseClient.disconnect();
}

async function testSseConnectionLifecycle() {
  log('\n--- Testing SSE Connection Lifecycle ---');

  // Test multiple connect/disconnect cycles
  for (let i = 1; i <= 3; i++) {
    const client = new MCPClient({
      servers: {
        main: {
          url: new URL(`${BASE_URL}/api/mcp/${mainServerId}/sse`),
          requestInit: { headers: authHeaders },
        },
      },
    });

    try {
      const tools = await client.listTools();
      const toolCount = Object.keys(tools).filter(k => k.startsWith('main_')).length;
      if (toolCount === 3) {
        success(`SSE: Connection cycle ${i} - connect and list tools`);
      } else {
        fail(`SSE: Connection cycle ${i} - connect and list tools`, `Expected 3 tools, got ${toolCount}`);
      }
      await client.disconnect();
      success(`SSE: Connection cycle ${i} - disconnect`);
    } catch (error) {
      fail(`SSE: Connection cycle ${i}`, error);
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}

async function testToolResponseFormat() {
  log('\n--- Testing Tool Response Format ---');

  const httpClient = new MCPClient({
    servers: {
      main: {
        url: new URL(`${BASE_URL}/api/mcp/${mainServerId}/mcp`),
        requestInit: { headers: authHeaders },
      },
    },
  });

  try {
    // Verify tool response has expected MCP format
    const tools = await httpClient.listTools();
    const calculateTool = tools['main_calculate'];
    if (!calculateTool || !calculateTool.execute) {
      throw new Error('Calculator tool not found');
    }

    const result = await calculateTool.execute({ operation: 'subtract', a: 50, b: 8 });

    // Verify response structure
    if (result && result.content && Array.isArray(result.content) && result.content[0]?.text) {
      const output = JSON.parse(result.content[0].text);
      if (output.result === 42 && output.operation === 'subtract' && output.operands) {
        success('HTTP: Tool response has correct MCP format');
      } else {
        fail('HTTP: Tool response has correct MCP format', `Unexpected output: ${JSON.stringify(output)}`);
      }
    } else {
      fail('HTTP: Tool response has correct MCP format', 'Response missing expected structure');
    }
  } catch (error) {
    fail('HTTP: Tool response format test', error);
  }

  try {
    // Verify echo tool response includes timestamp
    const tools = await httpClient.listTools();
    const echoTool = tools['main_echo'];
    if (!echoTool || !echoTool.execute) {
      throw new Error('Echo tool not found');
    }

    const result = await echoTool.execute({ message: 'test timestamp' });
    const output = JSON.parse(result.content[0].text);

    if (output.echo === 'test timestamp' && output.timestamp) {
      // Verify timestamp is a valid ISO date
      const date = new Date(output.timestamp);
      if (!isNaN(date.getTime())) {
        success('HTTP: Echo tool includes valid timestamp');
      } else {
        fail('HTTP: Echo tool includes valid timestamp', `Invalid timestamp: ${output.timestamp}`);
      }
    } else {
      fail('HTTP: Echo tool includes valid timestamp', 'Missing echo or timestamp in response');
    }
  } catch (error) {
    fail('HTTP: Echo tool timestamp test', error);
  }

  await httpClient.disconnect();
}

async function testErrorHandling() {
  log('\n--- Testing Error Handling ---');

  try {
    // Test 404 for non-existent server
    const res = await fetch(`${BASE_URL}/api/mcp/non-existent-server/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...authHeaders,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
        id: 1,
      }),
    });
    if (res.status === 404) {
      success('HTTP: Returns 404 for non-existent server');
    } else {
      fail('HTTP: Returns 404 for non-existent server', `Expected 404, got ${res.status}`);
    }
  } catch (error) {
    fail('HTTP: Returns 404 for non-existent server', error);
  }

  try {
    // Test 404 for non-existent SSE server
    const res = await fetch(`${BASE_URL}/api/mcp/non-existent-server/sse`, {
      headers: authHeaders,
    });
    if (res.status === 404) {
      success('SSE: Returns 404 for non-existent server');
    } else {
      fail('SSE: Returns 404 for non-existent server', `Expected 404, got ${res.status}`);
    }
  } catch (error) {
    fail('SSE: Returns 404 for non-existent server', error);
  }
}

async function runTests() {
  log(`\n========================================`);
  log(`  MCP Server Adapter Tests`);
  log(`  Testing against: ${BASE_URL}`);
  log(`  Server type: ${serverType}`);
  log(`  Timestamp: ${new Date().toISOString()}`);
  log(`========================================`);

  await testHealthCheck();
  await testHttpTransport();
  await testSseTransport();
  await testSseConnectionLifecycle();
  await testToolResponseFormat();
  await testErrorHandling();

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  log(`\n========================================`);
  log(`  Summary: ${passed} passed, ${failed} failed`);
  log(`========================================\n`);

  if (failed > 0) {
    log('Failed tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        log(`  - ${r.name}: ${r.error}`);
      });
    log('');
  }

  // Write output to file
  writeOutput();

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  log(`\nTest runner failed: ${error}`);
  writeOutput();
  process.exit(1);
});
