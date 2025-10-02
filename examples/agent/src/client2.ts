import { MCPClient, ProgressHandler } from '@mastra/mcp';
// import type { ElicitationHandler } from '@mastra/mcp';

const progressHandler: ProgressHandler = async params => {
  console.log('\n📊 Progress Update:');
  console.log(`Progress Token: ${params.progressToken}`);
  console.log(`Progress: ${params.progress}`);
  if (params.total) {
    console.log(`Total: ${params.total}`);
  }
  if (params.message) {
    console.log(`Message: ${params.message}`);
  }
};

async function main() {
  const mcpClient = new MCPClient({
    servers: {
      myMcpServerTwo: {
        url: new URL('http://localhost:4111/api/mcp/myMcpServerTwo/mcp'),
        enableProgressTracking: true,
      },
    },
  });

  mcpClient.progress.onUpdate('myMcpServerTwo', progressHandler);

  try {
    console.log('Connecting to MCP server...');
    const tools = await mcpClient.getTools();
    console.log('Available tools:', Object.keys(tools));

    // Test progress functionality
    console.log('\n🧪 Testing progress functionality...');
    const longRunningTaskTool = tools['myMcpServerTwo_longRunningTask'];
    if (longRunningTaskTool) {
      console.log('\nCalling longRunningTask tool...');
      const result = await longRunningTaskTool.execute({ context: { interval: 1000, count: 10 } });
      console.log('Result:', result);
    } else {
      console.log('❌ longRunningTask tool not found');
      console.log('Available tools:', Object.keys(tools));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mcpClient.disconnect();
  }
}

main().catch(console.error);
