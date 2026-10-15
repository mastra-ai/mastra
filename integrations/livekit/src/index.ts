// Server-safe entry point. This module is imported by Mastra server code and by
// agent/workflow definition files that the worker process also loads, so nothing
// here may pull in the `@livekit/agents` runtime (worker-only code lives in
// `@mastra/livekit/worker`). `src/index.test.ts` enforces this.
export { liveKitConnectionRoute } from './routes';
export type { LiveKitConnectionRouteOptions, LiveKitConnectionDetails, ConnectionRequestArgs } from './routes';
export { dispatchVoiceSession } from './dispatch';
export type { DispatchVoiceSessionOptions } from './dispatch';
export { LiveKitRecordingRoomConflictError } from './recording';
export type { LiveKitRecordingOptions } from './recording';
export { liveKitRecordingRoute } from './recording-route';
export type { LiveKitRecording, LiveKitRecordingResponse } from './recording-types';
export type { LiveKitRecordingResolverArgs, LiveKitRecordingRouteOptions } from './recording-route';
export { LiveKitSessionMetadataSchema, parseSessionMetadata, serializeSessionMetadata } from './metadata';
export type { LiveKitSessionMetadata } from './metadata';
export { LiveKitSessionConfigSchema } from './session-config';
export type { LiveKitSessionConfig, LiveKitSessionOptions } from './session-config';
export { pipeAgentReplyToWriter } from './workflow-generator';
export type { AgentReplyStreamLike } from './workflow-generator';
export { createConsentTool } from './consent';
export type { ConsentGrant, ConsentToolOptions } from './consent';
export { createEndCallTool } from './end-call';
export type { EndCallRequest, EndCallToolOptions } from './end-call';
export { DEFAULT_LIVEKIT_AGENT_NAME } from './constants';

export type { VoiceGenerationMetrics, VoiceSpeechMetrics, VoiceTurnMetrics, VoiceSpeechResult } from './turn-metrics';
