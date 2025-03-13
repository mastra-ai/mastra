import fs from 'fs/promises';
import child_process from 'node:child_process';
import util from 'node:util';
import path from 'path';
import * as p from '@clack/prompts';
import fsExtra from 'fs-extra/esm';
import color from 'picocolors';
import prettier from 'prettier';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import { FileService } from '../../services/service.file';
import { logger } from '../../utils/logger';

const exec = util.promisify(child_process.exec);

export type LLMProvider = 'openai' | 'anthropic' | 'groq' | 'google' | 'cerebras';
export type Components = 'agents' | 'workflows' | 'tools';

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
      return '@ai-sdk/cerebras'
    default:
      return '@ai-sdk/openai';
  }
};

export const getProviderImportAndModelItem = (llmProvider: LLMProvider) => {
  let providerImport = '';
  let modelItem = '';

  if (llmProvider === 'openai') {
    providerImport = `import { openai } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `openai('gpt-4o')`;
  } else if (llmProvider === 'anthropic') {
    providerImport = `import { anthropic } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `anthropic('claude-3-5-sonnet-20241022')`;
  } else if (llmProvider === 'groq') {
    providerImport = `import { groq } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `groq('llama-3.3-70b-versatile')`;
  } else if (llmProvider === 'google') {
    providerImport = `import { google } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `google('gemini-1.5-pro-latest')`;
  } else if (llmProvider === 'cerebras') {
    providerImport = `import { cerebras } from '${getAISDKPackage(llmProvider)}';`;
    modelItem = `cerebras('llama-3.3-70b')`;
  }
  return { providerImport, modelItem };
};

export async function writeAgentSample(llmProvider: LLMProvider, destPath: string, addExampleTool: boolean) {
  const { providerImport, modelItem } = getProviderImportAndModelItem(llmProvider);

  const instructions = `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      ${addExampleTool ? 'Use the weatherTool to fetch current weather data.' : ''}
`;
  const content = `
${providerImport}
import { Agent } from '@mastra/core/agent';
${addExampleTool ? `import { weatherTool } from '../tools';` : ''}

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: \`${instructions}\`,
  model: ${modelItem},
  ${addExampleTool ? 'tools: { weatherTool },' : ''}
});
    `;
  const formattedContent = await prettier.format(content, {
    parser: 'typescript',
    singleQuote: true,
  });

  await fs.writeFile(destPath, '');
  await fs.writeFile(destPath, formattedContent);
}

export async function writeWorkflowSample(destPath: string, llmProvider: LLMProvider) {
  const { providerImport, modelItem } = getProviderImportAndModelItem(llmProvider);

  const content = `${providerImport}
import { Agent } from '@mastra/core/agent';
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const llm = ${modelItem};

const agent = new Agent({
  name: 'Weather Agent',
  model: llm,
  instructions: \`
        You are a local activities and travel expert who excels at weather-based planning. Analyze the weather data and provide practical activity recommendations.

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

        Maintain this exact formatting for consistency, using the emoji and section headers as shown.
      \`,
});

const fetchWeather = new Step({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  execute: async ({ context }) => {
    const triggerData = context?.getStepResult<{ city: string }>('trigger');

    if (!triggerData) {
      throw new Error('Trigger data not found');
    }

    const geocodingUrl = \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(triggerData.city)}&count=1\`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(\`Location '\${triggerData.city}' not found\`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,weathercode&timezone=auto\`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_mean: number[];
        weathercode: number[];
      };
    };

    const forecast = data.daily.time.map((date: string, index: number) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[index],
      minTemp: data.daily.temperature_2m_min[index],
      precipitationChance: data.daily.precipitation_probability_mean[index],
      condition: getWeatherCondition(data.daily.weathercode[index]!),
      location: name,
    }));

    return forecast;
  },
});

const forecastSchema = z.array(
  z.object({
    date: z.string(),
    maxTemp: z.number(),
    minTemp: z.number(),
    precipitationChance: z.number(),
    condition: z.string(),
    location: z.string(),
  }),
);

const planActivities = new Step({
  id: 'plan-activities',
  description: 'Suggests activities based on weather conditions',
  inputSchema: forecastSchema,
  execute: async ({ context, mastra }) => {
    const forecast = context?.getStepResult<z.infer<typeof forecastSchema>>('fetch-weather');

    if (!forecast || forecast.length === 0) {
      throw new Error('Forecast data not found');
    }

    const prompt = \`Based on the following weather forecast for \${forecast[0]?.location}, suggest appropriate activities:
      \${JSON.stringify(forecast, null, 2)}
      \`;

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
  };
  return conditions[code] || 'Unknown';
}

const weatherWorkflow = new Workflow({
  name: 'weather-workflow',
  triggerSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
})
  .step(fetchWeather)
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
      return writeWorkflowSample(destPath, llmprovider);
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
import { createLogger } from '@mastra/core/logger';
${addWorkflow ? `import { weatherWorkflow } from './workflows';` : ''}
${addAgent ? `import { weatherAgent } from './agents';` : ''}

export const mastra = new Mastra({
  ${filteredExports.join('\n  ')}
  logger: createLogger({
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

export const checkAndInstallCoreDeps = async () => {
  const depsService = new DepsService();
  const depCheck = await depsService.checkDependencies(['@mastra/core']);

  if (depCheck !== 'ok') {
    await installCoreDeps();
  }
};

const spinner = yoctoSpinner({ text: 'Installing Mastra core dependencies\n' });
export async function installCoreDeps() {
  try {
    const confirm = await p.confirm({
      message: 'You do not have the @mastra/core package installed. Would you like to install it?',
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

    await depsService.installPackages(['@mastra/core@latest']);
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
  await exec(`echo ${key}=${apiKey} >> .env.development`);
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
  const destPath = dirPath + `/${component}/index.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath, importComponents);
  } catch (err) {
    throw err;
  }
};

export const interactivePrompt = async () => {
  p.intro(color.inverse('Mastra Init'));
  const mastraProject = await p.group(
    {
      directory: () =>
        p.text({
          message: 'Where should we create the Mastra files? (default: src/)',
          placeholder: 'src/',
          defaultValue: 'src/',
        }),
      components: () =>
        p.multiselect({
          message: 'Choose components to install:',
          options: [
            { value: 'agents', label: 'Agents', hint: 'recommended' },
            {
              value: 'workflows',
              label: 'Workflows',
            },
          ],
        }),
      shouldAddTools: () =>
        p.confirm({
          message: 'Add tools?',
          initialValue: false,
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
      addExample: () =>
        p.confirm({
          message: 'Add example',
          initialValue: false,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );

  const { shouldAddTools, components, ...rest } = mastraProject;
  const mastraComponents = shouldAddTools ? [...components, 'tools'] : components;

  return { ...rest, components: mastraComponents };
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
