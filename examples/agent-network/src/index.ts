import { mastra } from './mastra';

async function main() {
  const researchNetwork = mastra.getNetwork('Research_Network');

  if (!researchNetwork) {
    throw new Error('Research network not found');
  }

  console.log('🔍 Starting research on Napoleon Bonaparte...\n');

  // Generate a report using the research network
  // Using the generate() method as per the API update (MEMORY[8bf54da9-89a8-4e5b-b875-234a1aa8a53b])
  const result = await researchNetwork.stream('Give me a report on Napoleon Bonaparte', {
    maxSteps: 20, // Allow enough steps for the LLM router to determine the best agents to use
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'error':
        console.error(part.error);
        break;
      case 'text-delta':
        process.stdout.write(part.textDelta);
        break;
      case 'tool-call':
        console.log(`calling tool ${part.toolName} with args ${JSON.stringify(part.args, null, 2)}`);
        break;
      case 'tool-result':
        console.log(`tool result ${JSON.stringify(part.result, null, 2)}`);
        break;
    }
  }

  // Display the final result
  console.log('\n\n📝 Final Research Report:\n');

  console.log('\n\n📊 Agent Interaction Summary:');
  console.log(researchNetwork.getAgentInteractionSummary());

  console.log('\n🏁 Research complete!');
}

// Run the main function with error handling
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
