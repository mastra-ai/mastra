import { mastra } from './';
import { serve } from '@hono/node-server';
import { createHonoServer } from '@mastra/deployer/server';

const app = await createHonoServer(mastra);

// Start the server on port 3000 so Inngest can send events to it
const srv = serve({
  fetch: app.fetch,
  port: 3000,
});

console.log('Server running on http://localhost:3000');
console.log('Inngest endpoint: http://localhost:3000/api/inngest');
console.log('\nMake sure the Inngest dev server is running:');
console.log('  npx inngest-cli@latest dev -u http://localhost:3000/api/inngest\n');

// Wait for Inngest to sync with the app (give it time to discover functions)
console.log('Waiting for Inngest to sync...');
await new Promise(resolve => setTimeout(resolve, 3000));

const workflow = mastra.getWorkflow('activityPlanningWorkflow');
const run = await workflow.createRun();

console.log('Starting workflow with runId:', run.runId);
console.log('\n📊 OBSERVABILITY: Watch for trace events in the console output below');
console.log('   The ConsoleExporter will log span events (🚀 SPAN_STARTED, ✅ SPAN_ENDED)');
console.log('─'.repeat(80));

// Start the workflow with the required input data (city name)
// This will trigger the workflow steps and stream the result to the console
const result = await run.start({ inputData: { city: 'New York' } });

console.log('\n' + '─'.repeat(80));
console.log('📋 WORKFLOW RESULT:');
console.log(`Status: ${result.status}`);
if (result.status === 'success' && 'result' in result) {
  console.log('Result:', JSON.stringify(result.result, null, 2));
}
if (result.status === 'failed' && 'error' in result) {
  console.log('Error:', result.error);
}

console.log('\n' + '─'.repeat(80));
console.log('📈 OBSERVABILITY SUMMARY:');
console.log('   The trace events logged above (🚀 SPAN_STARTED, ✅ SPAN_ENDED) show that');
console.log('   Mastra observability is working with Inngest workflows.');
console.log('');
console.log('   Each span captures:');
console.log('   - Workflow execution (workflow_run)');
console.log('   - Individual step execution (workflow_step)');
console.log('   - Agent/model calls (agent_run, model_generation)');
console.log('   - Tool invocations (tool_call)');
console.log('');
console.log('   For production use, configure exporters like:');
console.log('   - LangfuseExporter for Langfuse dashboard');
console.log('   - DatadogExporter for Datadog LLM Observability');
console.log('   - OtelExporter for OpenTelemetry-compatible backends');

// Close the server after the workflow run is complete
srv.close();
