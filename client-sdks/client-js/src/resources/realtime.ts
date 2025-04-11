// https://platform.openai.com/docs/guides/realtime-webrtc

import type {
  GetAgentResponse,
  ClientOptions,
  BrowserTool,
  RealtimeClientConnectOptions,
  AgentStreamParams,
} from '../types';

import { BaseResource } from './base';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Agent } from './agent';
import { z } from 'zod';

export class RealtimeConnection extends BaseResource {
  private connectOptions: RealtimeClientConnectOptions;
  private agents: Record<string, GetAgentResponse> = {};

  constructor(options: ClientOptions, connectOptions: RealtimeClientConnectOptions) {
    super(options);
    this.connectOptions = connectOptions;
  }

  async createSessionToken(options: { model: string; voice: string }) {
    const session = await this.request<{ client_secret?: { value: string }; error?: { message: string } }>(
      '/api/sessions',
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
    );

    if (session?.error) {
      throw new Error(session.error.message);
    }

    return session?.client_secret?.value;
  }

  sendMessage(_message: unknown) {
    throw new Error('Send message called before connection');
  }

  sendSessionUpdate(session: { instructions?: string; tools?: unknown[]; tool_choice?: 'auto' | 'none' | 'required' }) {
    this.sendMessage({
      type: 'session.update',
      session,
    });
  }

  sendResponse(instructions: string) {
    this.sendMessage({
      type: 'response.create',
      response: {
        instructions,
      },
    });
  }

  async handleMessage(e: MessageEvent) {
    const { instructions, onMessage, browserTools, initialMessage, ...agentStreamOptions } = this.connectOptions;

    const data = JSON.parse(e.data);
    this.connectOptions.onMessage?.(data);

    if (data.type === 'session.created') {
      // Send the initial session update
      const openaiTools = [...fromBrowserTools(this.connectOptions.browserTools), ...fromMastraAgents(this.agents)];

      this.sendSessionUpdate({
        instructions,
        tools: openaiTools,
        tool_choice: 'auto',
      });

      if (initialMessage) {
        this.sendResponse(initialMessage);
      }
    } else if (data.type === 'response.done' && data.response.output) {
      for (const output of data.response.output) {
        if (output.type === 'function_call') {
          if (this.agents[output.name]) {
            const agent = new Agent(this.options, output.name);
            const input = JSON.parse(output.arguments);
            const res = await agent.stream(input);

            let text = '';
            await res.processDataStream(agentStreamOptions);
            this.sendResponse(text);

            return text;
          }

          const tool = browserTools[output.name];
          if (tool) {
            const input = JSON.parse(output.arguments);
            const result = await tool.execute(input, { connection: this });
            return result;
          }
        }
      }
    }
  }

  async connect() {
    this.agents = await this.request<Record<string, GetAgentResponse>>('/api/agents');

    const token = await this.createSessionToken({ model: this.connectOptions.model, voice: this.connectOptions.voice });

    if (!token) {
      throw new Error('Failed to create session token');
    }

    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    pc.ontrack = e => {
      audioEl.srcObject = e.streams[0] || null;
    };

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    const track = ms.getTracks()[0];
    if (track) {
      pc.addTrack(track);
    }

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel('oai-events');
    dc.addEventListener('message', async e => {
      // Realtime events appear here!
      await this.handleMessage(e);
    });

    this.sendMessage = (message: unknown) => {
      dc.send(JSON.stringify(message));
    };

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await sendAnswerSDP(this.connectOptions.model, offer, token);
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: sdpResponse,
    });
  }
}

function fromBrowserTools<Tools extends { [key: string]: BrowserTool<z.ZodSchema> }>(tools: Tools): unknown[] {
  return Object.entries(tools).map(([key, tool]) => ({
    type: 'function',
    name: key,
    description: tool.description,
    parameters: zodToJsonSchema(tool.inputSchema),
  }));
}

function fromMastraAgents(agents: Record<string, GetAgentResponse>): unknown[] {
  return Object.keys(agents).map(agentId => {
    const agent = agents[agentId];
    return {
      type: 'function',
      name: agentId,
      description: agent?.instructions ?? '',
      parameters: zodToJsonSchema(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ),
        }),
      ),
    };
  });
}

async function sendAnswerSDP(model: string, offer: RTCSessionDescriptionInit, clientSecret: string) {
  const response = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/sdp',
    },
  });
  return response.text();
}
