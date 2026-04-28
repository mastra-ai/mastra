import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import * as p from '@clack/prompts';
import type { ModelRouterModelId } from '@mastra/core/llm';
import fsExtra from 'fs-extra/esm';
import color from 'picocolors';
import shellQuote from 'shell-quote';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import { FileService } from '../../services/service.file';
import {
  cursorGlobalMCPConfigPath,
  windsurfGlobalMCPConfigPath,
  antigravityGlobalMCPConfigPath,
} from './mcp-docs-server-install';
import type { Editor } from './mcp-docs-server-install';

const exec = util.promisify(child_process.exec);

export const LLMProvider = ['openai', 'anthropic', 'groq', 'google', 'cerebras', 'mistral'] as const;
export const COMPONENTS = ['agents', 'workflows', 'tools', 'scorers'] as const;

export type LLMProvider = (typeof LLMProvider)[number];
export type Component = (typeof COMPONENTS)[number];

/**
 * Type-guard to check if a value is a valid LLMProvider
 */
export function isValidLLMProvider(value: string): value is LLMProvider {
  return LLMProvider.includes(value as LLMProvider);
}

/**
 * Type-guard to check if a value contains only valid Components
 */
export function areValidComponents(values: string[]): values is Component[] {
  return values.every(value => COMPONENTS.includes(value as Component));
}

export const getModelIdentifier = (llmProvider: LLMProvider): ModelRouterModelId => {
  let model: ModelRouterModelId = 'openai/gpt-5-mini';

  if (llmProvider === 'anthropic') {
    model = 'anthropic/claude-sonnet-4-5';
  } else if (llmProvider === 'groq') {
    model = 'groq/llama-3.3-70b-versatile';
  } else if (llmProvider === 'google') {
    model = 'google/gemini-2.5-pro';
  } else if (llmProvider === 'cerebras') {
    model = 'cerebras/llama-3.3-70b';
  } else if (llmProvider === 'mistral') {
    model = 'mistral/mistral-medium-2508';
  }

  return model;
};

export async function writeAgentSample(
  llmProvider: LLMProvider,
  destPath: string,
  addExampleTool: boolean,
  addScorers: boolean,
) {
  const modelString = getModelIdentifier(llmProvider);

  const instructions = `You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- If the location name isn't in English, please translate it
- If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative
- If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
- If the user asks for activities, respond in the format they request.${addExampleTool ? '\n\nUse the weatherTool to fetch current weather data.' : ''}`;
  const imports = [
    `import { Agent } from '@mastra/core/agent';`,
    `import { Memory } from '@mastra/memory';`,
    addExampleTool ? `import { weatherTool } from '../tools/weather-tool';` : undefined,
    addScorers ? `import { scorers } from '../scorers/weather-scorer';` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
  const toolsConfig = addExampleTool ? `  tools: { weatherTool },\n` : '';
  const scorersConfig = addScorers
    ? `  scorers: {
    toolCallAppropriateness: {
      scorer: scorers.toolCallAppropriatenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    completeness: {
      scorer: scorers.completenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    translation: {
      scorer: scorers.translationScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },
`
    : '';
  const content = `${imports}

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: \`${instructions}\`,
  model: '${modelString}',
${toolsConfig}${scorersConfig}  memory: new Memory(),
});
`;

  await fs.writeFile(destPath, content);
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

  await fs.writeFile(destPath, content);
}

export async function writeToolSample(destPath: string) {
  const fileService = new FileService();
  await fileService.copyStarterFile('tools.ts', destPath);
}

export async function writeScorersSample(llmProvider: LLMProvider, destPath: string) {
  const modelString = getModelIdentifier(llmProvider);
  const content = `import { z } from 'zod';
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '@mastra/evals/scorers/utils';
import { createScorer } from '@mastra/core/evals';

export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weatherTool',
  strictMode: false,
});

export const completenessScorer = createCompletenessScorer();

// Custom LLM-judged scorer: evaluates if non-English locations are translated appropriately
export const translationScorer = createScorer({
  id: 'translation-quality-scorer',
  name: 'Translation Quality',
  description: 'Checks that non-English location names are translated and used correctly',
  type: 'agent',
  judge: {
    model: '${modelString}',
    instructions:
      'You are an expert evaluator of translation quality for geographic locations. ' +
      'Determine whether the user text mentions a non-English location and whether the assistant correctly uses an English translation of that location. ' +
      'Be lenient with transliteration differences and diacritics. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Extract location names and detect language/translation adequacy',
    outputSchema: z.object({
      nonEnglish: z.boolean(),
      translated: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => \`
            You are evaluating if a weather assistant correctly handled translation of a non-English location.
            User text:
            """
            \${results.preprocessStepResult.userText}
            """
            Assistant response:
            """
            \${results.preprocessStepResult.assistantText}
            """
            Tasks:
            1) Identify if the user mentioned a location that appears non-English.
            2) If non-English, check whether the assistant used a correct English translation of that location in its response.
            3) Be lenient with transliteration differences (e.g., accents/diacritics).
            Return JSON with fields:
            {
            "nonEnglish": boolean,
            "translated": boolean,
            "confidence": number, // 0-1
            "explanation": string
            }
        \`,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    if (!r.nonEnglish) return 1; // If not applicable, full credit
    if (r.translated) return Math.max(0, Math.min(1, 0.7 + 0.3 * (r.confidence ?? 1)));
    return 0; // Non-English but not translated
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return \`Translation scoring: nonEnglish=\${r.nonEnglish ?? false}, translated=\${r.translated ?? false}, confidence=\${r.confidence ?? 0}. Score=\${score}. \${r.explanation ?? ''}\`;
  });

export const scorers = {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
};`;

  await fs.writeFile(destPath, content);
}

export async function writeCodeSampleForComponents(
  llmprovider: LLMProvider,
  component: Component,
  destPath: string,
  importComponents: Component[],
) {
  switch (component) {
    case 'agents':
      return writeAgentSample(
        llmprovider,
        destPath,
        importComponents.includes('tools'),
        importComponents.includes('scorers'),
      );
    case 'tools':
      return writeToolSample(destPath);
    case 'workflows':
      return writeWorkflowSample(destPath);
    case 'scorers':
      return writeScorersSample(llmprovider, destPath);
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
  addScorers,
}: {
  dirPath: string;
  addExample: boolean;
  addWorkflow: boolean;
  addAgent: boolean;
  addScorers: boolean;
}) => {
  const indexPath = dirPath + '/index.ts';
  const destPath = path.join(indexPath);
  try {
    await fs.writeFile(destPath, '');
    const filteredExports = [
      addWorkflow ? `workflows: { weatherWorkflow },` : '',
      addAgent ? `agents: { weatherAgent },` : '',
      addScorers ? `scorers: { toolCallAppropriatenessScorer, completenessScorer, translationScorer },` : '',
    ].filter(Boolean);
    if (!addExample) {
      await fs.writeFile(
        destPath,
        `
import { Mastra } from '@mastra/core/mastra';

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
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
${addWorkflow ? `import { weatherWorkflow } from './workflows/weather-workflow';` : ''}
${addAgent ? `import { weatherAgent } from './agents/weather-agent';` : ''}
${addScorers ? `import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer';` : ''}

export const mastra = new Mastra({
  ${filteredExports.join('\n  ')}
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      url: "file:./mastra.db",
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    }
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends observability data to hosted Mastra Studio (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
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

export const checkAndInstallCoreDeps = async (addExample: boolean, versionTag?: string) => {
  const spinner = yoctoSpinner({ text: 'Installing Mastra core dependencies' });
  let packages: Array<{ name: string; version: string }> = [];
  const mastraVersionTag = versionTag || 'latest';

  try {
    const depService = new DepsService();

    spinner.start();

    const needsCore = (await depService.checkDependencies(['@mastra/core'])) !== `ok`;
    const needsCli = (await depService.checkDependencies(['mastra'])) !== `ok`;
    const needsZod = (await depService.checkDependencies(['zod'])) !== `ok`;

    if (needsCore) {
      packages.push({ name: '@mastra/core', version: mastraVersionTag });
    }

    if (needsCli) {
      packages.push({ name: 'mastra', version: mastraVersionTag });
    }

    if (needsZod) {
      packages.push({ name: 'zod', version: '^4' });
    }

    if (addExample) {
      const needsLibsql = (await depService.checkDependencies(['@mastra/libsql'])) !== `ok`;

      if (needsLibsql) {
        packages.push({ name: '@mastra/libsql', version: mastraVersionTag });
      }
    }

    if (packages.length > 0) {
      await depService.installPackages(packages.map(pkg => `${pkg.name}@${pkg.version}`));
    }

    spinner.success('Successfully installed Mastra core dependencies');
  } catch (err) {
    spinner.error(`Failed to install core dependencies: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};

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
    case 'mistral':
      key = 'MISTRAL_API_KEY';
      return key;
    default:
      return key;
  }
};

export const writeAPIKey = async ({ provider, apiKey }: { provider: LLMProvider; apiKey?: string }) => {
  /**
   * If people skip entering an API key (because they e.g. have it in their environment already), we write to .env.example instead of .env so that they can immediately run Mastra without having to delete an .env file with an invalid key.
   */
  const envFileName = apiKey ? '.env' : '.env.example';

  const key = await getAPIKey(provider);
  const escapedKey = shellQuote.quote([key]);
  const escapedApiKey = shellQuote.quote([apiKey ? apiKey : 'your-api-key']);
  await exec(`echo ${escapedKey}=${escapedApiKey} >> ${envFileName}`);
};

/**
 * Append Mastra Observe credentials to the project's `.env` file.
 *
 * The generated `src/mastra/index.ts` template already registers a
 * `CloudExporter` which no-ops unless `MASTRA_CLOUD_ACCESS_TOKEN` is set, so
 * enabling Observe is a pure env-var concern from the scaffolder's side.
 *
 * When called with no token, writes empty placeholders so the user can paste
 * a key minted manually from the dashboard.
 */
export const writeObserveEnv = async ({ token, endpoint }: { token?: string; endpoint?: string } = {}) => {
  const envFilePath = path.join(process.cwd(), '.env');
  const lines = [
    '',
    '# Mastra Observe — https://cloud.mastra.ai',
    '# Create a project and paste your access token below to send traces to',
    '# the hosted Mastra Studio.',
    `MASTRA_CLOUD_ACCESS_TOKEN=${token ?? ''}`,
    `MASTRA_CLOUD_TRACES_ENDPOINT=${endpoint ?? ''}`,
    '',
  ];
  await fs.appendFile(envFilePath, lines.join('\n'));
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
  component: Component,
  llmProvider: LLMProvider,
  importComponents: Component[],
) => {
  const destPath = dirPath + `/${component}/weather-${component.slice(0, -1)}.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath, importComponents);
  } catch (err) {
    throw err;
  }
};

export const LLM_PROVIDERS: { value: LLMProvider; label: string; hint?: string }[] = [
  { value: 'openai', label: 'OpenAI', hint: 'recommended' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
  { value: 'google', label: 'Google' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'mistral', label: 'Mistral' },
];

interface InteractivePromptArgs {
  options?: {
    showBanner?: boolean;
  };
  skip?: {
    directory?: boolean;
    llmProvider?: boolean;
    llmApiKey?: boolean;
    gitInit?: boolean;
    skills?: boolean;
    mcpServer?: boolean;
    observe?: boolean;
  };
}

export const interactivePrompt = async (args: InteractivePromptArgs = {}) => {
  const { skip = {}, options: { showBanner = true } = {} } = args;

  if (showBanner) {
    p.intro(color.inverse(' Mastra Init '));
  }
  const mastraProject = await p.group(
    {
      directory: () =>
        skip?.directory
          ? undefined
          : p.text({
              message: 'Where should we create the Mastra files? (default: src/)',
              placeholder: 'src/',
              defaultValue: 'src/',
            }),
      llmProvider: () =>
        skip?.llmProvider
          ? undefined
          : p.select({
              message: 'Select a default provider:',
              options: LLM_PROVIDERS,
            }),
      llmApiKey: async ({ results: { llmProvider } }) => {
        if (skip?.llmApiKey) return undefined;

        const llmName = LLM_PROVIDERS.find(p => p.value === llmProvider)?.label || 'provider';
        const keyChoice = await p.select({
          message: `Enter your ${llmName} API key?`,
          options: [
            { value: 'skip', label: 'Skip for now', hint: 'default' },
            { value: 'enter', label: 'Enter API key' },
          ],
          initialValue: 'skip',
        });

        if (keyChoice === 'enter') {
          return p.password({
            message: 'Enter your API key:',
            mask: '*',
            clearOnError: true,
            validate: value => {
              if (!value || value.length === 0) return 'API key cannot be empty';
            },
          });
        }
        return undefined;
      },
      observe: async () => {
        if (skip?.observe) return undefined;

        const choice = await p.select({
          message: 'Enable Mastra Observe? (observability for your agents, workflows, and tools — free tier available)',
          options: [
            { value: 'yes', label: 'Yes, enable Mastra Observe', hint: 'recommended' },
            { value: 'no', label: 'No thanks' },
          ],
          initialValue: 'yes',
        });

        if (p.isCancel(choice)) return undefined;
        return choice === 'yes';
      },
      configureMastraToolingForAgents: async () => {
        if (skip?.skills && skip?.mcpServer) return { skills: undefined, mcpServer: undefined };

        const choice = await p.select({
          message: `Configure Mastra tooling for agents?`,
          options: [
            { value: 'skills', label: 'Skills', hint: 'recommended' },
            { value: 'mcp', label: 'MCP Docs Server' },
          ],
          initialValue: 'skills',
        });

        if (p.isCancel(choice)) {
          return { skills: undefined, mcpServer: undefined };
        }

        if (choice === 'skills') {
          // Popular agents
          const POPULAR_AGENTS: { value: string; label: string }[] = [
            { value: 'universal', label: 'Universal (Codex, Cursor, Gemini, GitHub, OpenCode)' },
            { value: 'claude-code', label: 'Claude Code' },
          ];

          // All agents (alphabetically)
          const ALL_AGENTS: { value: string; label: string }[] = [
            ...POPULAR_AGENTS,
            { value: 'adal', label: 'AdaL' },
            { value: 'antigravity', label: 'Antigravity' },
            { value: 'augment', label: 'Augment' },
            { value: 'codebuddy', label: 'CodeBuddy' },
            { value: 'command-code', label: 'Command Code' },
            { value: 'crush', label: 'Crush' },
            { value: 'droid', label: 'Droid' },
            { value: 'goose', label: 'Goose' },
            { value: 'iflow-cli', label: 'iFlow CLI' },
            { value: 'junie', label: 'Junie' },
            { value: 'kilo', label: 'Kilo Code' },
            { value: 'kiro-cli', label: 'Kiro CLI' },
            { value: 'kode', label: 'Kode' },
            { value: 'mcpjam', label: 'MCPJam' },
            { value: 'mistral-vibe', label: 'Mistral Vibe' },
            { value: 'mux', label: 'Mux' },
            { value: 'neovate', label: 'Neovate' },
            { value: 'openclaude', label: 'OpenClaude IDE' },
            { value: 'openclaw', label: 'OpenClaw' },
            { value: 'openhands', label: 'OpenHands' },
            { value: 'pi', label: 'Pi' },
            { value: 'pochi', label: 'Pochi' },
            { value: 'qoder', label: 'Qoder' },
            { value: 'qwen-code', label: 'Qwen Code' },
            { value: 'replit', label: 'Replit' },
            { value: 'roo', label: 'Roo Code' },
            { value: 'trae', label: 'Trae' },
            { value: 'trae-cn', label: 'Trae CN' },
            { value: 'windsurf', label: 'Windsurf' },
            { value: 'zencoder', label: 'Zencoder' },
          ];

          // Show popular agents first with "Show all" option
          const initialSelection = await p.select({
            message: `Select your agent:`,
            options: [...POPULAR_AGENTS, { value: '__show_all__', label: '+ Show all agents' }],
            initialValue: 'universal',
          });

          if (p.isCancel(initialSelection)) {
            return { skills: undefined, mcpServer: undefined };
          }

          let selectedAgents = new Set<string>();

          // If user selected "Show all", show full list
          if (initialSelection === '__show_all__') {
            const followUpSelection = await p.select({
              message: `Select your agent:`,
              options: ALL_AGENTS,
            });

            if (p.isCancel(followUpSelection)) {
              return { skills: undefined, mcpServer: undefined };
            }

            selectedAgents.add(followUpSelection);
          } else {
            selectedAgents.add(initialSelection);
          }

          // Always add "universal" type so that the definition there gets symlinked to the proprietary agent folders
          selectedAgents.add('universal');

          return { skills: Array.from(selectedAgents), mcpServer: undefined };
        }

        // If MCP selected, show editor sub-selection
        if (choice === 'mcp') {
          const editor = await p.select({
            message: `Which editor?`,
            options: [
              {
                value: 'cursor',
                label: 'Cursor (project only)',
              },
              {
                value: 'cursor-global',
                label: 'Cursor (global, all projects)',
              },
              {
                value: 'windsurf',
                label: 'Windsurf',
              },
              {
                value: 'vscode',
                label: 'VSCode',
              },
              {
                value: 'antigravity',
                label: 'Antigravity',
              },
            ] satisfies { value: Editor; label: string }[],
          });

          if (p.isCancel(editor)) {
            return { skills: undefined, mcpServer: undefined };
          }

          // Handle MCP editor selections with confirmations
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
                { value: 'no', label: 'No, cancel' },
              ],
            });
            if (confirm !== `yes`) {
              return { skills: undefined, mcpServer: undefined };
            }
          }

          if (editor === `windsurf`) {
            const confirm = await p.select({
              message: `Windsurf only supports a global MCP config (at ${windsurfGlobalMCPConfigPath}) is it ok to add/update that global config?\nThis means the Mastra docs MCP server will be available in all your Windsurf projects.`,
              options: [
                { value: 'yes', label: 'Yes, I understand' },
                { value: 'no', label: 'No, cancel' },
              ],
            });
            if (confirm !== `yes`) {
              return { skills: undefined, mcpServer: undefined };
            }
          }

          if (editor === `antigravity`) {
            const confirm = await p.select({
              message: `Antigravity only supports a global MCP config (at ${antigravityGlobalMCPConfigPath}). Is it ok to add/update that global config?\nThis will make the Mastra docs MCP server available in all Antigravity projects.`,
              options: [
                { value: 'yes', label: 'Yes, I understand' },
                { value: 'no', label: 'No, cancel' },
              ],
            });

            if (confirm !== `yes`) {
              return { skills: undefined, mcpServer: undefined };
            }
          }
          return { skills: undefined, mcpServer: editor };
        }

        return { skills: undefined, mcpServer: undefined };
      },
      initGit: async () => {
        if (skip?.gitInit) return false;

        return p.confirm({
          message: 'Initialize a new git repository?',
          initialValue: true,
        });
      },
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );

  // Flatten the configureMastraToolingForAgents return value
  const { configureMastraToolingForAgents, ...rest } = mastraProject;
  return {
    ...rest,
    skills: configureMastraToolingForAgents?.skills as string[] | undefined,
    mcpServer: configureMastraToolingForAgents?.mcpServer as Editor | undefined,
  };
};

/**
 * Check if the current directory has a package.json file. If not, we should alert the user to create one or run "mastra create" to create a new project. The package.json file is required to install dependencies in the next steps.
 */
export const checkForPkgJson = async () => {
  const cwd = process.cwd();
  const pkgJsonPath = path.join(cwd, 'package.json');

  try {
    await fs.access(pkgJsonPath);

    // Do nothing
  } catch {
    p.log.error(
      'No package.json file found in the current directory. Please run "npm init -y" to create one, or run "npx create-mastra@latest" to create a new Mastra project.',
    );

    process.exit(1);
  }
};

/**
 * Read the `name` field from the project's `package.json`, returning `undefined`
 * if the file is missing or unparseable.
 */
export const readPackageName = async (): Promise<string | undefined> => {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === 'string' && parsed.name.trim().length > 0 ? parsed.name : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Generate content for AGENTS.md file
 */
export function generateAgentsMarkdown({ skills, mcpServer }: { skills?: string[]; mcpServer?: Editor }): string {
  const hasSkills = skills && skills.length > 0;
  const hasMcp = !!mcpServer;

  let content = `# AGENTS.md

You are a TypeScript developer experienced with the Mastra framework. You build AI agents, tools, workflows, and scorers. You follow strict TypeScript practices and always consult up-to-date Mastra documentation before making changes.

`;

  // Add critical Mastra skill section if skills were installed
  if (hasSkills) {
    content += `
## CRITICAL: Load \`mastra\` skill

**BEFORE doing ANYTHING with Mastra, load the \`mastra\` skill FIRST.** Never rely on cached knowledge as Mastra's APIs change frequently between versions. Use the skill to read up-to-date documentation from \`node_modules\`.
`;
  }

  content += `
## Project Overview

This is a **Mastra** project written in TypeScript. Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. The Node.js runtime is \`>=22.13.0\`.

## Commands

\`\`\`bash
npm run dev # Start Mastra Studio at localhost:4111 (long-running, use a separate terminal)
npm run build # Build a production-ready server
\`\`\`

## Project Structure

| Folder                 | Description                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| \`src/mastra\`           | Entry point for all Mastra-related code and configuration.                                                                               |
| \`src/mastra/agents\`    | Define and configure your agents - their behavior, goals, and tools.                                                                     |
| \`src/mastra/workflows\` | Define multi-step workflows that orchestrate agents and tools together.                                                                  |
| \`src/mastra/tools\`     | Create reusable tools that your agents can call                                                                                          |
| \`src/mastra/mcp\`       | (Optional) Implement custom MCP servers to share your tools with external agents                                                         |
| \`src/mastra/scorers\`   | (Optional) Define scorers for evaluating agent performance over time                                                                     |
| \`src/mastra/public\`    | (Optional) Contents are copied into the \`.build/output\` directory during the build process, making them available for serving at runtime |

### Top-level files

Top-level files define how your Mastra project is configured, built, and connected to its environment.

| File                  | Description                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| \`src/mastra/index.ts\` | Central entry point where you configure and initialize Mastra.                                                    |
| \`.env.example\`        | Template for environment variables - copy and rename to \`.env\` to add your secret [model provider](/models) keys. |
| \`package.json\`        | Defines project metadata, dependencies, and available npm scripts.                                                |
| \`tsconfig.json\`       | Configures TypeScript options such as path aliases, compiler settings, and build output.                          |

## Boundaries

### Always do

- Load the \`mastra\` skill before any Mastra-related work
- Register new agents, tools, workflows, and scorers in \`src/mastra/index.ts\`
- Use schemas for tool inputs and outputs
- Run \`npm run build\` to verify changes compile

### Never do

- Never commit \`.env\` files or secrets
- Never modify \`node_modules\` or Mastra's database files directly
- Never hardcode API keys (always use environment variables)
`;

  // Add MCP section if MCP server was configured
  if (hasMcp) {
    const editorName =
      mcpServer === 'cursor-global' ? 'Cursor (global)' : mcpServer!.charAt(0).toUpperCase() + mcpServer!.slice(1);

    content += `## MCP Docs Server

This project has the Mastra MCP Docs Server configured for ${editorName}.

### Using MCP Docs

The MCP server provides embedded documentation access within your editor:

1. The server was automatically configured during project creation
2. Restart your editor to load the MCP server
3. Use the Mastra docs tools in your editor to access:
   - API references
   - Code examples
   - Integration guides

Learn more in the [MCP Documentation](https://mastra.ai/docs/mcp/overview).

`;
  }

  // Add resources section
  content += `## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
- [Mastra .well-known skills discovery](https://mastra.ai/.well-known/skills/index.json)
`;

  return content;
}

/**
 * Write AGENTS.md file to project root
 */
export async function writeAgentsMarkdown(options: { skills?: string[]; mcpServer?: Editor }): Promise<void> {
  const content = generateAgentsMarkdown(options);
  const filePath = path.join(process.cwd(), 'AGENTS.md');
  await fs.writeFile(filePath, content);
}

/**
 * Write CLAUDE.md file to project root
 */
export async function writeClaudeMarkdown(): Promise<void> {
  const filePath = path.join(process.cwd(), 'CLAUDE.md');
  await fs.writeFile(filePath, '@AGENTS.md');
}
