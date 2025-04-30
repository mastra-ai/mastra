import { MastraClient } from '@mastra/client-js';
import { z } from 'zod';

// Initialize the Mastra client
const client = new MastraClient({
  baseUrl: process.env.MASTRA_BASE_URL || 'http://localhost:4111',
});

/**
 * Example of using the A2A protocol to interact with agents
 */
async function main() {
  try {
    // Get the agent ID - this would be the ID of an agent you've created
    const agentId = process.env.AGENT_ID || 'researchAgent';

    console.log(`🤖 Connecting to agent: ${agentId} via A2A protocol\n`);

    // Get the A2A client for the agent
    const a2aClient = client.getA2A(agentId);

    // Step 1: Get the agent card to see its capabilities
    console.log('📋 Fetching agent card...');
    const agentCard = await a2aClient.getCard();

    console.log(`\nAgent Name: ${agentCard.name}`);
    console.log(`Description: ${agentCard.description}`);
    console.log(`Capabilities: ${agentCard.capabilities.join(', ')}`);
    console.log(`API Version: ${agentCard.apiVersion}`);
    console.log('\n-------------------\n');

    // Step 2: Send a message to the agent
    const taskId = `task-${Date.now()}`;
    console.log(`📤 Sending message to agent (Task ID: ${taskId})...`);

    const query = 'What are the latest developments in AI agent networks?';
    console.log(`Query: ${query}`);

    const response = await a2aClient.sendMessage({
      id: taskId,
      message: {
        role: 'user',
        content: query,
      },
    });

    console.log(`\nTask Status: ${response.task.status}`);
    console.log('\n🤖 Agent Response:');
    console.log(response.task.result?.message.content || 'No response content');

    console.log('\n-------------------\n');

    // Step 3: Get task status
    console.log(`📥 Checking task status (Task ID: ${taskId})...`);

    const taskStatus = await a2aClient.getTask({
      id: taskId,
    });

    console.log(`Task Status: ${taskStatus.task.status}`);
    console.log('\n-------------------\n');

    // Step 4: Demonstrate agent-to-agent communication
    console.log('🔄 Demonstrating agent-to-agent communication...');

    // Get another agent for A2A communication
    const secondAgentId = process.env.SECOND_AGENT_ID || 'contentCreatorAgent';
    console.log(`Connecting to second agent: ${secondAgentId}`);

    const secondA2aClient = client.getA2A(secondAgentId);

    // First agent gathers information
    const researchTaskId = `research-${Date.now()}`;
    console.log(`\nStep 1: First agent (${agentId}) researches the topic...`);

    const researchQuery = 'Provide a brief summary of agent networks in AI';
    const researchResponse = await a2aClient.sendMessage({
      id: researchTaskId,
      message: {
        role: 'user',
        content: researchQuery,
      },
    });

    const researchResult = researchResponse.task.result?.message.content || '';
    console.log('\nResearch Results:');
    console.log(researchResult.substring(0, 150) + '...');

    // Second agent transforms the research into content
    const contentTaskId = `content-${Date.now()}`;
    console.log(`\nStep 2: Second agent (${secondAgentId}) transforms research into content...`);

    const contentPrompt = `Transform this research into an engaging blog post introduction:\n\n${researchResult}`;
    const contentResponse = await secondA2aClient.sendMessage({
      id: contentTaskId,
      message: {
        role: 'user',
        content: contentPrompt,
      },
    });

    console.log('\nFinal Content:');
    console.log(contentResponse.task.result?.message.content || 'No content generated');

    console.log('\n-------------------\n');
    console.log('✅ A2A example completed successfully!');
  } catch (error) {
    console.error('❌ Error in A2A example:', error);
  }
}

// Run the example
main();
