import type { WebClient } from '@slack/web-api';
import type { Mastra } from '@mastra/core/mastra';

export interface StreamingOptions {
  mastra: Mastra;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  agentName: string;
  message: string;
  resourceId: string;
  threadId: string;
}

export interface StreamState {
  text: string;
  chunkType: string;
  toolName?: string;
  workflowName?: string;
  stepName?: string;
  agentName?: string;
}
