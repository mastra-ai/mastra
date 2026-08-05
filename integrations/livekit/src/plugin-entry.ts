// Plugin entry point (`@mastra/livekit/plugin`). This side loads the `@livekit/agents` runtime —
// it's for customers who own their own `voice.AgentSession` and want a Mastra agent in the `llm`
// slot. Plugin users don't inherit the worker wrapper's surface or its optional peers.
export { MastraLLM } from './llm-plugin';
export type { MastraLLMOptions } from './llm-plugin';
export { createRemoteAgentReplyGenerator } from './remote';
export type { RemoteMastraAgentOptions, RemoteAgentReplyGeneratorOptions } from './remote';
export type {
  MastraVoiceAgentMemory,
  VoiceReplyGenerator,
  VoiceToolCall,
  VoiceTurnCompleteContext,
  VoiceTurnCompleteHook,
  VoiceTurnContext,
  VoiceTurnResult,
  VoiceTurnUsage,
} from './bridge';
