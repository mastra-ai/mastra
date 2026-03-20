import { Agent } from '@mastra/core/agent';
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';

// Configuration
const config = {
  region: (process.env.AWS_REGION || 'us-east-1') as 'us-east-1' | 'us-west-2' | 'ap-northeast-1',
  voiceModel: 'amazon.nova-2-sonic-v1:0',
  agentModel: process.env.AGENT_MODEL || 'amazon/nova-pro',
  debug: true, // Enable debug logging to see what's happening
  // Voice configuration - can be 'tiffany' (polyglot, feminine), 'matthew' (polyglot, masculine),
  // or any other available voice: 'amy', 'olivia', 'kiara', 'arjun', 'ambre', 'florian',
  // 'beatrice', 'lorenzo', 'tina', 'lennart', 'lupe', 'carlos', 'carolina', 'leo'
  speaker: process.env.VOICE_SPEAKER || 'tiffany',
};

// Use global variable to ensure singleton persists across Next.js API routes
// In Next.js, module-level variables can be reset during hot reloading,
// so we use a global to ensure persistence
declare global {
  // eslint-disable-next-line no-var
  var __mastra_agent_instance__: Agent | undefined;
  // eslint-disable-next-line no-var
  var __mastra_agent_instance_id__: string | undefined;
}

// Store current configuration
let currentConfig = {
  speaker: config.speaker,
  endpointingSensitivity: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
};

// Singleton agent instance - shared across API routes
function getAgentInstance(options?: { speaker?: string; endpointingSensitivity?: 'HIGH' | 'MEDIUM' | 'LOW' }): Agent {
  // Update config if options provided
  if (options) {
    if (options.speaker !== undefined) {
      currentConfig.speaker = options.speaker;
    }
    if (options.endpointingSensitivity !== undefined) {
      currentConfig.endpointingSensitivity = options.endpointingSensitivity;
    }
  }

  // If agent exists and is connected, return it (config changes require reconnection)
  if (global.__mastra_agent_instance__) {
    const voiceState = (global.__mastra_agent_instance__.voice as any).state;
    console.log(`[getAgent] Returning existing global agent instance: ${global.__mastra_agent_instance_id__}, voice state: ${voiceState}`);
    
    // If disconnected and config changed, recreate with new config
    if (voiceState === 'disconnected' && options) {
      console.log('[getAgent] Config changed and agent disconnected, recreating with new config');
      global.__mastra_agent_instance__ = undefined;
      global.__mastra_agent_instance_id__ = undefined;
    } else {
      return global.__mastra_agent_instance__;
    }
  }

  // Create new instance
  const instanceId = `agent-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log(`[getAgent] Creating new agent instance: ${instanceId} with speaker: ${currentConfig.speaker}, endpointingSensitivity: ${currentConfig.endpointingSensitivity}`);
  
  // Create voice instance with enhanced configuration
  // Nova 2 Sonic supports many configuration options:
  // - sessionConfig.inferenceConfiguration: Control model behavior (maxTokens, temperature, topP, topK, stopSequences)
  // - sessionConfig.turnTaking: Control voice activity detection (vadSensitivity, silenceDurationMs)
  // - sessionConfig.tools: Define tools for function calling
  // - sessionConfig.knowledgeBaseConfig: Enable RAG with knowledge bases
  // - sessionConfig.toolChoice: Control which tools are used ('auto', 'any', or specific tool)
  // - sessionConfig.voice: Override voice selection (string or object with name, languageCode, gender)
  //
  // To get a list of all available voices, you can call:
  // const speakers = await voice.getSpeakers();
  // This returns an array with voiceId, name, language, locale, gender, and polyglot status
  const voice = new NovaSonicVoice({
    region: config.region,
    model: config.voiceModel,
    debug: config.debug,
    speaker: currentConfig.speaker,
    sessionConfig: {
      // Inference configuration - controls how the model generates responses
      inferenceConfiguration: {
        maxTokens: 4096, // Maximum tokens in response
        topP: 0.9, // Nucleus sampling parameter
        temperature: 0.7, // Controls randomness (lower = more deterministic)
        // topK: 50, // Optional: Top-K sampling
        // stopSequences: ['stop'], // Optional: Sequences that stop generation
      },
      // Turn detection configuration - controls when the model detects user speech completion
      // Nova 2 Sonic uses turnDetectionConfiguration with endpointingSensitivity
      turnDetectionConfiguration: {
        endpointingSensitivity: currentConfig.endpointingSensitivity, // Options: 'HIGH' (fastest, 1.5s), 'MEDIUM' (balanced, 1.75s), 'LOW' (slowest, 2s)
      },
      // Legacy turnTaking support (deprecated - use turnDetectionConfiguration instead)
      // turnTaking: {
      //   vadSensitivity: 0.5,
      //   silenceDurationMs: 1000,
      // },
      // Tools configuration - uncomment to enable function calling
      // tools: [
      //   {
      //     name: 'get_weather',
      //     description: 'Get current weather for a location',
      //     inputSchema: {
      //       type: 'object',
      //       properties: {
      //         location: { type: 'string', description: 'City name' },
      //       },
      //       required: ['location'],
      //     },
      //   },
      // ],
      // Tool choice - controls which tools are used
      // toolChoice: 'auto', // 'auto' (model decides), 'any' (use at least one), or { tool: { name: 'tool_name' } }
      // Knowledge base configuration - uncomment to enable RAG
      // knowledgeBaseConfig: {
      //   knowledgeBaseId: 'your-kb-id',
      //   dataSourceId: 'your-ds-id',
      // },
      // Voice configuration - can override speaker setting
      // voice: 'matthew', // or { name: 'tiffany', languageCode: 'en-US', gender: 'feminine' }
    },
  });

  // Create agent with voice
  const agentInstance = new Agent({
    id: 'nova-sonic-voice-agent',
    name: 'Nova Sonic Agent',
    instructions: 'You are a helpful assistant with real-time voice capabilities. Keep your responses concise and friendly.',
    model: config.agentModel,
    voice,
  });
  
  // Store in global for Next.js persistence
  global.__mastra_agent_instance__ = agentInstance;
  global.__mastra_agent_instance_id__ = instanceId;
  
  console.log(`[getAgent] Agent instance created: ${instanceId}, voice state: ${(voice as any).state}`);
  return agentInstance;
}

export function getAgent(options?: { speaker?: string; endpointingSensitivity?: 'HIGH' | 'MEDIUM' | 'LOW' }): Agent {
  return getAgentInstance(options);
}

