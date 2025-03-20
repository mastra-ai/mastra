import type { GenerateReturn, StreamReturn } from '@mastra/core';
import type { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type {
  GenerateParams,
  GetAgentResponse,
  GetEvalsByAgentIdResponse,
  GetToolResponse,
  ClientOptions,
  StreamParams,
} from '../types';

import { BaseResource } from './base';

export class AgentTool extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
    private toolId: string,
  ) {
    super(options);
  }

  /**
   * Executes a specific tool for an agent
   * @param params - Parameters required for tool execution
   * @returns Promise containing tool execution results
   */
  execute(params: { data: any }): Promise<any> {
    return this.request(`/api/agents/${this.agentId}/tools/${this.toolId}/execute`, {
      method: 'POST',
      body: params,
    });
  }
}

export class AgentVoice extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
  ) {
    super(options);
    this.agentId = agentId;
  }

  /**
   * Convert text to speech using the agent's voice provider
   * @param text - Text to convert to speech
   * @param options - Optional provider-specific options for speech generation
   * @returns Promise containing the audio data
   */
  async speak(text: string, options?: { speaker?: string; [key: string]: any }): Promise<Response> {
    return this.request<Response>(`/api/agents/${this.agentId}/voice/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { input: text, options },
      stream: true,
    });
  }

  /**
   * Convert speech to text using the agent's voice provider
   * @param audio - Audio data to transcribe
   * @param options - Optional provider-specific options
   * @returns Promise containing the transcribed text
   */
  listen(audio: Blob, options?: Record<string, any>): Promise<Response> {
    const formData = new FormData();
    formData.append('audio', audio);

    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request(`/api/agents/${this.agentId}/voice/listen`, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Get available speakers for the agent's voice provider
   * @returns Promise containing list of available speakers
   */
  getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    return this.request(`/api/agents/${this.agentId}/voice/speakers`);
  }
}

export class Agent extends BaseResource {
  public readonly voice: AgentVoice;

  constructor(
    options: ClientOptions,
    private agentId: string,
  ) {
    super(options);
    this.voice = new AgentVoice(options, this.agentId);
  }

  /**
   * Retrieves details about the agent
   * @returns Promise containing agent details including model and instructions
   */
  details(): Promise<GetAgentResponse> {
    return this.request(`/api/agents/${this.agentId}`);
  }

  /**
   * Generates a response from the agent
   * @param params - Generation parameters including prompt
   * @returns Promise containing the generated response
   */
  generate<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: GenerateParams<T>,
  ): Promise<GenerateReturn<T>> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return this.request(`/api/agents/${this.agentId}/generate`, {
      method: 'POST',
      body: processedParams,
    });
  }

  /**
   * Streams a response from the agent
   * @param params - Stream parameters including prompt
   * @returns Promise containing the streamed response
   */
  stream<T extends JSONSchema7 | ZodSchema | undefined = undefined>(params: StreamParams<T>): Promise<Response> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return this.request(`/api/agents/${this.agentId}/stream`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });
  }

  /**
   * Gets details about a specific tool available to the agent
   * @param toolId - ID of the tool to retrieve
   * @returns Promise containing tool details
   */
  getTool(toolId: string): Promise<GetToolResponse> {
    return this.request(`/api/agents/${this.agentId}/tools/${toolId}`);
  }

  /**
   * Retrieves evaluation results for the agent
   * @returns Promise containing agent evaluations
   */
  evals(): Promise<GetEvalsByAgentIdResponse> {
    return this.request(`/api/agents/${this.agentId}/evals/ci`);
  }

  /**
   * Retrieves live evaluation results for the agent
   * @returns Promise containing live agent evaluations
   */
  liveEvals(): Promise<GetEvalsByAgentIdResponse> {
    return this.request(`/api/agents/${this.agentId}/evals/live`);
  }
}
