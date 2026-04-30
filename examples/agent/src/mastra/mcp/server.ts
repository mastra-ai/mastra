import { createTool } from '@mastra/core/tools';
import { MCPServer, MCPServerResources } from '@mastra/mcp';
import type { AppResources } from '@mastra/mcp';
import { z } from 'zod';
import { chefAgent } from '../agents';
import { myWorkflow } from '../workflows';

// ============================================================================
// MCP Apps extension example — interactive HTML UIs served via ui:// resources
// ============================================================================

const calculatorAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 20px; background: #fafafa; color: #1a1a1a; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    .row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    input, select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    input[type="number"] { width: 120px; }
    button { padding: 8px 20px; background: #4f46e5; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    button:hover { background: #4338ca; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .result { margin-top: 12px; padding: 12px; background: #e8f5e9; border-radius: 6px; font-size: 15px; }
    .error { background: #ffebee; color: #c62828; }
  </style>
</head>
<body>
  <h2>Interactive Calculator</h2>
  <p style="color:#666; margin-bottom:16px; font-size:13px;">
    This UI is served as a <code>ui://</code> MCP App resource and calls the calculator tool via the bridge.
  </p>
  <div class="row">
    <input id="n1" type="number" placeholder="Number 1" value="42" />
    <select id="op">
      <option value="add">+</option>
      <option value="subtract">&minus;</option>
    </select>
    <input id="n2" type="number" placeholder="Number 2" value="8" />
    <button id="btn" onclick="calc()">Calculate</button>
  </div>
  <div id="result" class="result" style="display:none;"></div>
  <script>
    async function calc() {
      var btn = document.getElementById('btn');
      var resultDiv = document.getElementById('result');
      btn.disabled = true;
      btn.textContent = 'Calculating…';
      try {
        var result = await window.__mcpBridge.callTool('calculatorWithUI', {
          num1: Number(document.getElementById('n1').value),
          num2: Number(document.getElementById('n2').value),
          operation: document.getElementById('op').value,
        });
        resultDiv.className = 'result';
        resultDiv.textContent = 'Result: ' + JSON.stringify(result);
        resultDiv.style.display = 'block';
      } catch (err) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Error: ' + err.message;
        resultDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Calculate';
      }
    }
  </script>
</body>
</html>`;

const greetingAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 20px; background: #f0f4ff; color: #1a1a1a; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    .row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
    input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; flex: 1; }
    button { padding: 8px 20px; background: #059669; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    button:hover { background: #047857; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .result { margin-top: 12px; padding: 12px; background: #ecfdf5; border-radius: 6px; font-size: 15px; }
  </style>
</head>
<body>
  <h2>Greeting App</h2>
  <p style="color:#666; margin-bottom:16px; font-size:13px;">
    Enter a name and the tool will generate a personalized greeting.
  </p>
  <div class="row">
    <input id="name" type="text" placeholder="Your name" value="World" />
    <button id="btn" onclick="greet()">Greet</button>
  </div>
  <div id="result" class="result" style="display:none;"></div>
  <script>
    async function greet() {
      var btn = document.getElementById('btn');
      var resultDiv = document.getElementById('result');
      btn.disabled = true;
      try {
        var result = await window.__mcpBridge.callTool('greetUserWithUI', {
          name: document.getElementById('name').value,
        });
        resultDiv.textContent = result;
        resultDiv.style.display = 'block';
      } catch (err) {
        resultDiv.textContent = 'Error: ' + err.message;
        resultDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;

const mcpAppResources: AppResources = {
  'ui://calculator/app': {
    name: 'Interactive Calculator',
    description: 'A calculator UI that calls the calculatorWithUI tool via MCP Apps bridge',
    html: calculatorAppHtml,
  },
  'ui://greeting/app': {
    name: 'Greeting App',
    description: 'A greeting UI that calls the greetUserWithUI tool via MCP Apps bridge',
    html: greetingAppHtml,
  },
};

// Resources implementation
const weatherResources: MCPServerResources = {
  listResources: async () => {
    return [
      {
        uri: 'weather://current',
        name: 'Current Weather Data',
        description: 'Real-time weather data for the current location',
        mimeType: 'application/json',
      },
      {
        uri: 'weather://forecast',
        name: 'Weather Forecast',
        description: '5-day weather forecast',
        mimeType: 'application/json',
      },
      {
        uri: 'weather://historical',
        name: 'Historical Weather Data',
        description: 'Weather data from the past 30 days',
        mimeType: 'application/json',
      },
    ];
  },
  getResourceContent: async ({ uri }) => {
    if (uri === 'weather://current') {
      return [
        {
          text: JSON.stringify({
            location: 'San Francisco',
            temperature: 18,
            conditions: 'Partly Cloudy',
            humidity: 65,
            windSpeed: 12,
            updated: new Date().toISOString(),
          }),
        },
      ];
    } else if (uri === 'weather://forecast') {
      return [
        {
          text: JSON.stringify([
            { day: 1, high: 19, low: 12, conditions: 'Sunny' },
            { day: 2, high: 22, low: 14, conditions: 'Clear' },
            { day: 3, high: 20, low: 13, conditions: 'Partly Cloudy' },
            { day: 4, high: 18, low: 11, conditions: 'Rain' },
            { day: 5, high: 17, low: 10, conditions: 'Showers' },
          ]),
        },
      ];
    } else if (uri === 'weather://historical') {
      return [
        {
          text: JSON.stringify({
            averageHigh: 20,
            averageLow: 12,
            rainDays: 8,
            sunnyDays: 18,
            recordHigh: 28,
            recordLow: 7,
          }),
        },
      ];
    }

    throw new Error(`Resource not found: ${uri}`);
  },
  resourceTemplates: async () => {
    return [
      {
        uriTemplate: 'weather://custom/{city}/{days}',
        name: 'Custom Weather Forecast',
        description: 'Generates a custom weather forecast for a city and number of days.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'weather://alerts?region={region}&level={level}',
        name: 'Weather Alerts',
        description: 'Get weather alerts for a specific region and severity level.',
        mimeType: 'application/json',
      },
    ];
  },
};

export const myMcpServer = new MCPServer({
  id: 'my-calculation-and-data-mcp-server',
  name: 'My Calculation & Data MCP Server',
  version: '1.0.0',
  tools: {
    calculator: createTool({
      id: 'calculator',
      description: 'Performs basic arithmetic operations (add, subtract).',
      inputSchema: z.object({
        num1: z.number().describe('The first number.'),
        num2: z.number().describe('The second number.'),
        operation: z.enum(['add', 'subtract']).describe('The operation to perform.'),
      }),
      execute: async input => {
        const { num1, num2, operation } = input;
        if (operation === 'add') {
          return num1 + num2;
        }
        if (operation === 'subtract') {
          return num1 - num2;
        }
        throw new Error('Invalid operation');
      },
    }),
    fetchWeather: createTool({
      id: 'fetchWeather',
      description: 'Fetches a (simulated) weather forecast for a given city.',
      inputSchema: z.object({
        city: z.string().describe('The city to get weather for, e.g., London, Paris.'),
      }),
      execute: async input => {
        const { city } = input;
        const temperatures = {
          london: '15°C',
          paris: '18°C',
          tokyo: '22°C',
        };
        const temp = temperatures[city.toLowerCase() as keyof typeof temperatures] || '20°C';
        return `The weather in ${city} is ${temp} and sunny.`;
      },
    }),
  },
});

// ============================================================================
// MCP Apps Server — demonstrates interactive HTML UIs via the MCP Apps extension
// ============================================================================

export const mcpAppsServer = new MCPServer({
  id: 'mcp-apps-demo-server',
  name: 'MCP Apps Demo Server',
  version: '1.0.0',
  appResources: mcpAppResources,
  tools: {
    calculatorWithUI: createTool({
      id: 'calculatorWithUI',
      description: 'Calculator with an interactive MCP App UI. Performs add or subtract.',
      inputSchema: z.object({
        num1: z.number().describe('First operand'),
        num2: z.number().describe('Second operand'),
        operation: z.enum(['add', 'subtract']).describe('Operation to perform'),
      }),
      mcp: {
        _meta: { ui: { resourceUri: 'ui://calculator/app' } },
      },
      execute: async ({ num1, num2, operation }) => {
        if (operation === 'add') return num1 + num2;
        if (operation === 'subtract') return num1 - num2;
        throw new Error('Invalid operation');
      },
    }),
    greetUserWithUI: createTool({
      id: 'greetUserWithUI',
      description: 'Generates a personalized greeting with an interactive MCP App UI.',
      inputSchema: z.object({
        name: z.string().describe('Name of the person to greet'),
      }),
      mcp: {
        _meta: { ui: { resourceUri: 'ui://greeting/app' } },
      },
      execute: async ({ name }) => {
        return `Hello, ${name}! Welcome to MCP Apps.`;
      },
    }),
  },
});

export const myMcpServerTwo = new MCPServer({
  name: 'My Utility MCP Server',
  id: 'my-utility-mcp-server',
  version: '1.0.0',
  agents: { chefAgent },
  workflows: { myWorkflow },
  resources: weatherResources,
  tools: {
    stringUtils: createTool({
      id: 'stringUtils',
      description: 'Performs utility operations on strings (uppercase, reverse).',
      inputSchema: z.object({
        text: z.string().describe('The input string.'),
        action: z.enum(['uppercase', 'reverse']).describe('The string action to perform.'),
      }),
      execute: async inputData => {
        const { text, action } = inputData;
        if (action === 'uppercase') {
          return text.toUpperCase();
        }
        if (action === 'reverse') {
          return text.split('').reverse().join('');
        }
        throw new Error('Invalid string action');
      },
    }),
    greetUser: createTool({
      id: 'greetUser',
      description: 'Generates a personalized greeting.',
      inputSchema: z.object({
        name: z.string().describe('The name of the person to greet.'),
      }),
      execute: async inputData => {
        return `Hello, ${inputData.name}! Welcome to the MCP server.`;
      },
    }),
    collectContactInfo: createTool({
      id: 'collectContactInfo',
      description: 'Collects user contact information through elicitation.',
      inputSchema: z.object({
        reason: z.string().optional().describe('Optional reason for collecting contact info'),
      }),
      execute: async (inputData, context) => {
        const { reason } = inputData;

        try {
          // Use the session-aware elicitation functionality
          const result = await context.mcp.elicitation.sendRequest({
            message: reason
              ? `Please provide your contact information. ${reason}`
              : 'Please provide your contact information',
            requestedSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  title: 'Full Name',
                  description: 'Your full name',
                },
                email: {
                  type: 'string',
                  title: 'Email Address',
                  description: 'Your email address',
                  format: 'email',
                },
                phone: {
                  type: 'string',
                  title: 'Phone Number',
                  description: 'Your phone number (optional)',
                },
              },
              required: ['name', 'email'],
            },
          });

          if (result.action === 'accept') {
            return `Thank you! Contact information collected: ${JSON.stringify(result.content, null, 2)}`;
          } else if (result.action === 'reject') {
            return 'Contact information collection was declined by the user.';
          } else {
            return 'Contact information collection was cancelled by the user.';
          }
        } catch (error) {
          return `Error collecting contact information: ${error}`;
        }
      },
    }),
  },
});

/**
 * Simulates an update to the content of 'weather://current'.
 * In a real application, this would be called when the underlying data for that resource changes.
 */
export const simulateCurrentWeatherUpdate = async () => {
  console.log('[Example] Simulating update for weather://current');
  // If you have access to the server instance that uses these resources (e.g., myMcpServerTwo)
  // you would call its notification method.
  await myMcpServerTwo.resources.notifyUpdated({ uri: 'weather://current' });
  console.log('[Example] Notification sent for weather://current update.');
};

/**
 * Simulates a change in the list of available weather resources (e.g., a new forecast type becomes available).
 * In a real application, this would be called when the overall list of resources changes.
 */
export const simulateResourceListChange = async () => {
  console.log('[Example] Simulating a change in the list of available weather resources.');
  // This would typically involve updating the actual list returned by `listResources`
  // and then notifying the server.
  // For this example, we'll just show the notification part.
  await myMcpServerTwo.resources.notifyListChanged();
  console.log('[Example] Notification sent for resource list change.');
};
