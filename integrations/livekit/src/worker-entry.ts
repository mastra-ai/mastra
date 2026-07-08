// Worker entry point (`@mastra/livekit/worker`). This side loads the
// `@livekit/agents` runtime, so keep it out of Mastra server code — import it
// only from the worker process entry file.
export {
  createLiveKitWorker,
  // À-la-carte toolkit for customers who own their session but want our greeting / hang-up
  // patterns (pair with `createEndCallTool` + `MastraLLM`'s `onToolCall` to rebuild agent-
  // initiated hang-up).
  speakGreeting,
  waitForAgentDoneSpeaking,
  runEndCall,
  DEFAULT_END_CALL_TOOL,
  DEFAULT_END_CALL_REASON,
  DEFAULT_END_CALL_MAX_WAIT_MS,
} from './worker';
export type {
  ConsentConfiguration,
  ConsentRequirement,
  CreateLiveKitWorkerOptions,
  EndCallConfiguration,
  GreetingConfiguration,
  GreetingContext,
  GreetingText,
  LiveKitWorkerConfiguration,
  ResolveMastraAgentArgs,
  SessionComponentResolver,
  SessionStartArgs,
  VoiceCallContext,
  VoiceCallEndArgs,
  VoiceCallEndHook,
} from './worker';
export { runLiveKitWorker } from './run';
export type { RunLiveKitWorkerOptions } from './run';
export { chatContextToMessages } from './messages';
export type { VoiceTurnMessage } from './messages';
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
// The MastraLLM plugin, re-exported here for discoverability (both entries load the LiveKit
// runtime anyway). Its canonical home is `@mastra/livekit/plugin`.
export { MastraLLM } from './llm-plugin';
export type { MastraLLMOptions } from './llm-plugin';
export { createRemoteAgentReplyGenerator } from './remote';
export type { RemoteMastraAgentOptions, RemoteAgentReplyGeneratorOptions } from './remote';
