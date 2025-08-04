import fs from 'fs/promises';
import child_process from 'node:child_process';
import util from 'node:util';
import path from 'path';
import * as p from '@clack/prompts';
import fsExtra from 'fs-extra/esm';
import color from 'picocolors';
import prettier from 'prettier';
import shellQuote from 'shell-quote';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import { FileService } from '../../services/service.file';
import { logger } from '../../utils/logger';
import {
  cursorGlobalMCPConfigPath,
  globalMCPIsAlreadyInstalled,
  windsurfGlobalMCPConfigPath,
} from './mcp-docs-server-install';

const exec = util.promisify(child_process.exec);

export type LLMProvider = 'openai' | 'anthropic' | 'groq' | 'google' | 'cerebras';
export type Components = 'agents' | 'workflows' | 'tools';

export const getAISDKPackageVersion = (llmProvider: LLMProvider) => {
  switch (llmProvider) {
    case 'cerebras':
      return '^0.2.14';
    default:
      return '^1.0.0';
  }
};
export const getAISDKPackage = (llmProvider: LLMProvider) => {
  switch (llmProvider) {
    case 'openai':
      return '@ai-sdk/openai';
    case 'anthropic':
      return '@ai-sdk/anthropic';
    case 'groq':
      return '@ai-sdk/groq';
    case 'google':
      return '@ai-sdk/google';
    case 'cerebras':
      return '@ai-sdk/cerebras';
    default:
      return '@ai-sdk/openai';
  }
};

export const getProviderImportAndModelItem = (llmProvider: LLMProvider) => {
  let providerImport = '';
  let modelItem = '';

  if (llmProvider === 'openai') {
    providerImport = `import { openai } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `openai('gpt-4o-mini')`;
  } else if (llmProvider === 'anthropic') {
    providerImport = `import { anthropic } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `anthropic('claude-3-5-sonnet-20241022')`;
  } else if (llmProvider === 'groq') {
    providerImport = `import { groq } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `groq('llama-3.3-70b-versatile')`;
  } else if (llmProvider === 'google') {
    providerImport = `import { google } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `google('gemini-2.5-pro')`;
  } else if (llmProvider === 'cerebras') {
    providerImport = `import { cerebras } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `cerebras('llama-3.3-70b')`;
  }
  return { providerImport, modelItem };
};

export async function writeAgentSample(llmProvider: LLMProvider, destPath: string, addExampleTool: boolean) {
  const { providerImport, modelItem } = getProviderImportAndModelItem(llmProvider);

  const instructions = `
      You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative
      - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
      - If the user asks for activities, respond in the format they request.

      ${addExampleTool ? 'Use the weatherTool to fetch current weather data.' : ''}
`;
  const content = `
${providerImport}
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
${addExampleTool ? `import { weatherTool } from '../tools/weather-tool';` : ''}

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: \`${instructions}\`,
  model: ${modelItem},
  ${addExampleTool ? 'tools: { weatherTool },' : ''}
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db", // path is relative to the .mastra/output directory
    })
  })
});
    `;
  const formattedContent = await prettier.format(content, {
    parser: 'typescript',
    singleQuote: true,
  });

  await fs.writeFile(destPath, '');
  await fs.writeFile(destPath, formattedContent);
}

export async function writeWorkflowSample(destPath: string) {
  const content = `import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
})

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    95: 'Thunderstorm',
  }
  return conditions[code] || 'Unknown'
}

const fetchWeather = createStep({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const geocodingUrl = \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(inputData.city)}&count=1\`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(\`Location '\${inputData.city}' not found\`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m\`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string
        precipitation: number
        weathercode: number
      }
      hourly: {
        precipitation_probability: number[]
        temperature_2m: number[]
      }
    }

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0
      ),
      location: name
    }

    return forecast;
  },
});


const planActivities = createStep({
  id: 'plan-activities',
  description: 'Suggests activities based on weather conditions',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData

    if (!forecast) {
      throw new Error('Forecast data not found')
    }

    const agent = mastra?.getAgent('weatherAgent');
    if (!agent) {
      throw new Error('Weather agent not found');
    }

    const prompt = \`Based on the following weather forecast for \${forecast.location}, suggest appropriate activities:
      \${JSON.stringify(forecast, null, 2)}
      For each day in the forecast, structure your response exactly as follows:

      📅 [Day, Month Date, Year]
      ═══════════════════════════

      🌡️ WEATHER SUMMARY
      • Conditions: [brief description]
      • Temperature: [X°C/Y°F to A°C/B°F]
      • Precipitation: [X% chance]

      🌅 MORNING ACTIVITIES
      Outdoor:
      • [Activity Name] - [Brief description including specific location/route]
        Best timing: [specific time range]
        Note: [relevant weather consideration]

      🌞 AFTERNOON ACTIVITIES
      Outdoor:
      • [Activity Name] - [Brief description including specific location/route]
        Best timing: [specific time range]
        Note: [relevant weather consideration]

      🏠 INDOOR ALTERNATIVES
      • [Activity Name] - [Brief description including specific venue]
        Ideal for: [weather condition that would trigger this alternative]

      ⚠️ SPECIAL CONSIDERATIONS
      • [Any relevant weather warnings, UV index, wind conditions, etc.]

      Guidelines:
      - Suggest 2-3 time-specific outdoor activities per day
      - Include 1-2 indoor backup options
      - For precipitation >50%, lead with indoor activities
      - All activities must be specific to the location
      - Include specific venues, trails, or locations
      - Consider activity intensity based on temperature
      - Keep descriptions concise but informative

      Maintain this exact formatting for consistency, using the emoji and section headers as shown.\`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let activitiesText = '';

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});

const weatherWorkflow = createWorkflow({
  id: 'weather-workflow',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  })
})
  .then(fetchWeather)
  .then(planActivities);

weatherWorkflow.commit();

export { weatherWorkflow };`;

  const formattedContent = await prettier.format(content, {
    parser: 'typescript',
    semi: true,
    singleQuote: true,
  });

  await fs.writeFile(destPath, formattedContent);
}

export async function writeToolSample(destPath: string) {
  const fileService = new FileService();
  await fileService.copyStarterFile('tools.ts', destPath);
}

export async function writeCodeSampleForComponents(
  llmprovider: LLMProvider,
  component: Components,
  destPath: string,
  importComponents: Components[],
) {
  switch (component) {
    case 'agents':
      return writeAgentSample(llmprovider, destPath, importComponents.includes('tools'));
    case 'tools':
      return writeToolSample(destPath);
    case 'workflows':
      return writeWorkflowSample(destPath);
    default:
      return '';
  }
}

export const createComponentsDir = async (dirPath: string, component: string) => {
  const componentPath = dirPath + `/${component}`;

  await fsExtra.ensureDir(componentPath);
};

export const writeIndexFile = async ({
  dirPath,
  addAgent,
  addExample,
  addWorkflow,
}: {
  dirPath: string;
  addExample: boolean;
  addWorkflow: boolean;
  addAgent: boolean;
}) => {
  const indexPath = dirPath + '/index.ts';
  const destPath = path.join(indexPath);
  try {
    await fs.writeFile(destPath, '');
    const filteredExports = [
      addWorkflow ? `workflows: { weatherWorkflow },` : '',
      addAgent ? `agents: { weatherAgent },` : '',
    ].filter(Boolean);
    if (!addExample) {
      await fs.writeFile(
        destPath,
        `
import { Mastra } from '@mastra/core';

export const mastra = new Mastra()
        `,
      );

      return;
    }
    await fs.writeFile(
      destPath,
      `
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
${addWorkflow ? `import { weatherWorkflow } from './workflows/weather-workflow';` : ''}
${addAgent ? `import { weatherAgent } from './agents/weather-agent';` : ''}

export const mastra = new Mastra({
  ${filteredExports.join('\n  ')}
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
`,
    );
  } catch (err) {
    throw err;
  }
};

export const checkInitialization = async (dirPath: string) => {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
};

export const checkAndInstallCoreDeps = async (addExample: boolean) => {
  const depsService = new DepsService();
  let depCheck = await depsService.checkDependencies(['@mastra/core']);

  if (depCheck !== 'ok') {
    await installCoreDeps('@mastra/core');
  }

  if (addExample) {
    depCheck = await depsService.checkDependencies(['@mastra/libsql']);

    if (depCheck !== 'ok') {
      await installCoreDeps('@mastra/libsql');
    }
  }
};

const spinner = yoctoSpinner({ text: 'Installing Mastra core dependencies\n' });
export async function installCoreDeps(pkg: string) {
  try {
    const confirm = await p.confirm({
      message: `You do not have the ${pkg} package installed. Would you like to install it?`,
      initialValue: false,
    });

    if (p.isCancel(confirm)) {
      p.cancel('Installation Cancelled');
      process.exit(0);
    }

    if (!confirm) {
      p.cancel('Installation Cancelled');
      process.exit(0);
    }

    spinner.start();

    const depsService = new DepsService();

    await depsService.installPackages([`${pkg}@latest`]);
    spinner.success('@mastra/core installed successfully');
  } catch (err) {
    console.error(err);
  }
}

export const getAPIKey = async (provider: LLMProvider) => {
  let key = 'OPENAI_API_KEY';
  switch (provider) {
    case 'anthropic':
      key = 'ANTHROPIC_API_KEY';
      return key;
    case 'groq':
      key = 'GROQ_API_KEY';
      return key;
    case 'google':
      key = 'GOOGLE_GENERATIVE_AI_API_KEY';
      return key;
    case 'cerebras':
      key = 'CEREBRAS_API_KEY';
      return key;
    default:
      return key;
  }
};

export const writeAPIKey = async ({
  provider,
  apiKey = 'your-api-key',
}: {
  provider: LLMProvider;
  apiKey?: string;
}) => {
  const key = await getAPIKey(provider);
  const escapedKey = shellQuote.quote([key]);
  const escapedApiKey = shellQuote.quote([apiKey]);
  await exec(`echo ${escapedKey}=${escapedApiKey} >> .env`);
};
export const createMastraDir = async (directory: string): Promise<{ ok: true; dirPath: string } | { ok: false }> => {
  let dir = directory
    .trim()
    .split('/')
    .filter(item => item !== '');

  const dirPath = path.join(process.cwd(), ...dir, 'mastra');

  try {
    await fs.access(dirPath);
    return { ok: false };
  } catch {
    await fsExtra.ensureDir(dirPath);
    return { ok: true, dirPath };
  }
};

export const writeCodeSample = async (
  dirPath: string,
  component: Components,
  llmProvider: LLMProvider,
  importComponents: Components[],
) => {
  const destPath = dirPath + `/${component}/weather-${component.slice(0, -1)}.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath, importComponents);
  } catch (err) {
    throw err;
  }
};

export const interactivePrompt = async () => {
  p.intro(color.inverse(' Mastra Init '));
  const mastraProject = await p.group(
    {
      directory: () =>
        p.text({
          message: 'Where should we create the Mastra files? (default: src/)',
          placeholder: 'src/',
          defaultValue: 'src/',
        }),
      llmProvider: () =>
        p.select({
          message: 'Select default provider:',
          options: [
            { value: 'openai', label: 'OpenAI', hint: 'recommended' },
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'groq', label: 'Groq' },
            { value: 'google', label: 'Google' },
            { value: 'cerebras', label: 'Cerebras' },
          ],
        }),
      llmApiKey: async ({ results: { llmProvider } }) => {
        const keyChoice = await p.select({
          message: `Enter your ${llmProvider} API key?`,
          options: [
            { value: 'skip', label: 'Skip for now', hint: 'default' },
            { value: 'enter', label: 'Enter API key' },
          ],
          initialValue: 'skip',
        });

        if (keyChoice === 'enter') {
          return p.text({
            message: 'Enter your API key:',
            placeholder: 'sk-...',
          });
        }
        return undefined;
      },
      configureEditorWithDocsMCP: async () => {
        const windsurfIsAlreadyInstalled = await globalMCPIsAlreadyInstalled(`windsurf`);
        const cursorIsAlreadyInstalled = await globalMCPIsAlreadyInstalled(`cursor`);
        const vscodeIsAlreadyInstalled = await globalMCPIsAlreadyInstalled(`vscode`);

        const editor = await p.select({
          message: `Make your AI IDE into a Mastra expert? (installs Mastra docs MCP server)`,
          options: [
            { value: 'skip', label: 'Skip for now', hint: 'default' },
            {
              value: 'cursor',
              label: 'Cursor (project only)',
              hint: cursorIsAlreadyInstalled ? `Already installed globally` : undefined,
            },
            {
              value: 'cursor-global',
              label: 'Cursor (global, all projects)',
              hint: cursorIsAlreadyInstalled ? `Already installed` : undefined,
            },
            {
              value: 'windsurf',
              label: 'Windsurf',
              hint: windsurfIsAlreadyInstalled ? `Already installed` : undefined,
            },
            {
              value: 'vscode',
              label: 'VSCode',
              hint: vscodeIsAlreadyInstalled ? `Already installed` : undefined,
            },
          ],
        });

        if (editor === `skip`) return undefined;
        if (editor === `windsurf` && windsurfIsAlreadyInstalled) {
          p.log.message(`\nWindsurf is already installed, skipping.`);
          return undefined;
        }
        if (editor === `vscode` && vscodeIsAlreadyInstalled) {
          p.log.message(`\nVSCode is already installed, skipping.`);
          return undefined;
        }

        if (editor === `cursor`) {
          p.log.message(
            `\nNote: you will need to go into Cursor Settings -> MCP Settings and manually enable the installed Mastra MCP server.\n`,
          );
        }

        if (editor === `cursor-global`) {
          const confirm = await p.select({
            message: `Global install will add/update ${cursorGlobalMCPConfigPath} and make the Mastra docs MCP server available in all your Cursor projects. Continue?`,
            options: [
              { value: 'yes', label: 'Yes, I understand' },
              { value: 'skip', label: 'No, skip for now' },
            ],
          });
          if (confirm !== `yes`) {
            return undefined;
          }
        }

        if (editor === `windsurf`) {
          const confirm = await p.select({
            message: `Windsurf only supports a global MCP config (at ${windsurfGlobalMCPConfigPath}) is it ok to add/update that global config?\nThis means the Mastra docs MCP server will be available in all your Windsurf projects.`,
            options: [
              { value: 'yes', label: 'Yes, I understand' },
              { value: 'skip', label: 'No, skip for now' },
            ],
          });
          if (confirm !== `yes`) {
            return undefined;
          }
        }

        return editor;
      },
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );

  return mastraProject;
};

export const checkPkgJson = async () => {
  const cwd = process.cwd();
  const pkgJsonPath = path.join(cwd, 'package.json');

  let isPkgJsonPresent = false;

  try {
    await fsExtra.readJSON(pkgJsonPath);
    isPkgJsonPresent = true;
  } catch {
    isPkgJsonPresent = false;
  }

  if (isPkgJsonPresent) {
    return;
  }

  logger.debug('package.json not found, create one or run "mastra create" to create a new project');
  process.exit(0);
};
