import { MCPClient } from '@mastra/mcp';
// import type { ElicitationHandler } from '@mastra/mcp';
import { createInterface } from 'readline';

// Create readline interface for user input
const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to prompt user for input
function askQuestion(question: string): Promise<string> {
  return new Promise(resolve => {
    readline.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

// Elicitation handler that prompts the user for input
const elicitationHandler = async request => {
  console.log('\n🔔 Elicitation Request Received:');
  console.log(`Message: ${request.message}`);
  console.log('Requested Schema:');
  console.log(JSON.stringify(request.requestedSchema, null, 2));

  const schema = request.requestedSchema;
  const properties = schema.properties;
  const required = schema.required || [];

  console.log('\nPlease provide the following information:');

  const content: Record<string, unknown> = {};

  // Collect input for each field
  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    const field = fieldSchema as {
      type?: string;
      title?: string;
      description?: string;
      format?: string;
    };

    const isRequired = required.includes(fieldName);
    let prompt = `${field.title || fieldName}`;

    // Add helpful information to the prompt
    if (field.description) {
      prompt += ` (${field.description})`;
    }
    if (field.format) {
      prompt += ` [format: ${field.format}]`;
    }
    if (isRequired) {
      prompt += ' *required*';
    }

    prompt += ': ';

    const answer = await askQuestion(prompt);

    // Check for cancellation
    if (answer.toLowerCase() === 'cancel' || answer.toLowerCase() === 'c') {
      return { action: 'cancel' as const };
    }

    // Handle empty responses
    if (answer === '' && isRequired) {
      console.log(`❌ Error: ${fieldName} is required`);
      return { action: 'reject' as const };
    } else if (answer !== '') {
      content[fieldName] = answer;
    }
  }

  // Show the collected data and ask for confirmation
  console.log('\n✅ Collected data:');
  console.log(JSON.stringify(content, null, 2));

  const confirmAnswer = await askQuestion('\nSubmit this information? (yes/no/cancel): ');

  if (confirmAnswer.toLowerCase() === 'yes' || confirmAnswer.toLowerCase() === 'y') {
    return {
      action: 'accept' as const,
      content,
    };
  } else if (confirmAnswer.toLowerCase() === 'cancel' || confirmAnswer.toLowerCase() === 'c') {
    return { action: 'cancel' as const };
  } else {
    return { action: 'reject' as const };
  }
};

async function main() {
  const mcpClient = new MCPClient({
    servers: {
      myMcpServerTwo: {
        url: new URL('http://localhost:4111/api/mcp/myMcpServerTwo/mcp'),
      },
    },
  });

  mcpClient.elicitation.onRequest('myMcpServerTwo', elicitationHandler);

  try {
    console.log('Connecting to MCP server...');
    const tools = await mcpClient.getTools();
    console.log('Available tools:', Object.keys(tools));

    // Test the elicitation functionality
    console.log('\n🧪 Testing elicitation functionality...');

    // Find the collectContactInfo tool
    const collectContactInfoTool = tools['myMcpServerTwo_collectContactInfo'];
    if (collectContactInfoTool) {
      console.log('\nCalling collectContactInfo tool...');

      try {
        const result = await collectContactInfoTool.execute({
          context: {
            reason: 'We need your contact information to send you updates about our service.',
          },
        });

        console.log('\n📋 Tool Result:');
        console.log(result);
      } catch (error) {
        console.error('❌ Error calling collectContactInfo tool:', error);
      }
    } else {
      console.log('❌ collectContactInfo tool not found');
      console.log('Available tools:', Object.keys(tools));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    readline.close();
    await mcpClient.disconnect();
  }
}

main().catch(console.error);
