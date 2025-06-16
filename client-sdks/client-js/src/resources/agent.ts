import { processDataStream } from '@ai-sdk/ui-utils';
import { type GenerateReturn } from '@mastra/core';
import type { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { processClientTools } from '../utils/process-client-tools';

import type {
  GenerateParams,
  GetAgentResponse,
  GetEvalsByAgentIdResponse,
  GetToolResponse,
  ClientOptions,
  StreamParams,
} from '../types';

import { BaseResource } from './base';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { parseClientRuntimeContext } from '../utils';

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
  listen(audio: Blob, options?: Record<string, any>): Promise<{ text: string }> {
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

  /**
   * Get the listener configuration for the agent's voice provider
   * @returns Promise containing a check if the agent has listening capabilities
   */
  getListener(): Promise<{ enabled: boolean }> {
    return this.request(`/api/agents/${this.agentId}/voice/listener`);
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
    params: GenerateParams<T> & { output?: never; experimental_output?: never },
  ): Promise<GenerateReturn<T>>;
  generate<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: GenerateParams<T> & { output: T; experimental_output?: never },
  ): Promise<GenerateReturn<T>>;
  generate<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: GenerateParams<T> & { output?: never; experimental_output: T },
  ): Promise<GenerateReturn<T>>;
  generate<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: GenerateParams<T>,
  ): Promise<GenerateReturn<T>> {
    const processedParams = {
      ...params,
      output: params.output ? zodToJsonSchema(params.output) : undefined,
      experimental_output: params.experimental_output ? zodToJsonSchema(params.experimental_output) : undefined,
      runtimeContext: parseClientRuntimeContext(params.runtimeContext),
      clientTools: processClientTools(params.clientTools),
    };

    return this.request(`/api/agents/${this.agentId}/generate`, {
      method: 'POST',
      body: processedParams,
    });
  }

  /**
   * Streams a response from the agent
   * @param params - Stream parameters including prompt
   * @returns Promise containing the enhanced Response object with processDataStream method
   */
  async stream<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: StreamParams<T>,
  ): Promise<
    Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    }
  > {
    const processedParams = {
      ...params,
      output: params.output ? zodToJsonSchema(params.output) : undefined,
      experimental_output: params.experimental_output ? zodToJsonSchema(params.experimental_output) : undefined,
      runtimeContext: parseClientRuntimeContext(params.runtimeContext),
      clientTools: processClientTools(params.clientTools),
    };

    const response: Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    } = await this.request(`/api/agents/${this.agentId}/stream`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    response.processDataStream = async (options = {}) => {
      await processDataStream({
        stream: response.body as ReadableStream<Uint8Array>,
        ...options,
      });
    };

    return response;
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
   * Executes a tool for the agent
   * @param toolId - ID of the tool to execute
   * @param params - Parameters required for tool execution
   * @returns Promise containing the tool execution results
   */
  executeTool(toolId: string, params: { data: any; runtimeContext?: RuntimeContext }): Promise<any> {
    const body = {
      data: params.data,
      runtimeContext: params.runtimeContext ? Object.fromEntries(params.runtimeContext.entries()) : undefined,
    };
    return this.request(`/api/agents/${this.agentId}/tools/${toolId}/execute`, {
      method: 'POST',
      body,
    });
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
