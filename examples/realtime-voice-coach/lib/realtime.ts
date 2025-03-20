// https://platform.openai.com/docs/guides/realtime-webrtc

import { AnyZodObject } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

export type ExecuteToolInputFn<I> = (input: I, { connection }: { connection: Connection }) => void;

export interface Tool<I = unknown> {
  id: string;
  inputSchema: AnyZodObject;
  description: string;
  execute: ExecuteToolInputFn<I>;
}

export interface Connection {
  sendMessage: (message: unknown) => void;
  sendResponseCreate: (instructions: string) => void;
  sendSessionUpdate: (session: {
    instructions?: string;
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | 'required';
  }) => void;
}

function fromMastraTools(tools: Tool[]): unknown[] {
  return tools.map(tool => ({
    type: 'function',
    name: tool.id,
    description: tool.description,
    parameters: zodToJsonSchema(tool.inputSchema),
  }));
}

export async function connectToOpenAIRealtime({
  model,
  voice,
  tools,
  instructions,
  initialMessage,
  onMessage,
}: {
  model: string;
  voice: string;
  tools: Tool[];
  instructions: string;
  initialMessage: string;
  onMessage?: (data: any) => void;
}) {
  const response = await createSession({ model, voice });

  const EPHEMERAL_KEY = response.client_secret.value;

  // Create a peer connection
  const pc = new RTCPeerConnection();

  // Set up to play remote audio from the model
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  pc.ontrack = e => (audioEl.srcObject = e.streams[0]);

  // Add local audio track for microphone input in the browser
  const ms = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  pc.addTrack(ms.getTracks()[0]);

  // Set up data channel for sending and receiving events
  const dc = pc.createDataChannel('oai-events');
  dc.addEventListener('message', async e => {
    // Realtime server events appear here!
    const data = JSON.parse(e.data);
    onMessage?.(data);

    if (data.type === 'session.created') {
      // Send the initial session update
      const openaiTools = fromMastraTools(tools);

      sendSessionUpdate({
        instructions,
        tools: openaiTools,
        tool_choice: 'auto',
      });

      sendResponseCreate(initialMessage);
    } else if (data.type === 'response.done' && data.response.output) {
      for (const output of data.response.output) {
        if (output.type === 'function_call') {
          const tool = tools.find(t => t.id === output.name);
          if (tool) {
            const input = JSON.parse(output.arguments);
            const result = await tool.execute(input, { connection });
            console.log(result);
          }
        }
      }
    }
  });

  // Start the session using the Session Description Protocol (SDP)
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResponse = await sendAnswerSDP(model, offer, EPHEMERAL_KEY);

  const answer = {
    type: 'answer' as const,
    sdp: sdpResponse,
  };
  await pc.setRemoteDescription(answer);

  const sendMessage = (message: unknown) => {
    dc.send(JSON.stringify(message));
  };

  const sendSessionUpdate = (session: {
    instructions?: string;
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | 'required';
  }) => {
    // https://platform.openai.com/docs/guides/realtime-model-capabilities#session-lifecycle-events
    sendMessage({
      type: 'session.update',
      session,
    });
  };

  const sendResponseCreate = (instructions: string) => {
    sendMessage({
      type: 'response.create',
      response: {
        instructions,
      },
    });
  };

  const connection = {
    sendMessage,
    sendResponseCreate,
    sendSessionUpdate,
  };

  return connection;
}

async function createSession({
  model,
  voice,
}: {
  model: string;
  voice: string;
}): Promise<{ client_secret: { value: string } }> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ model, voice }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
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
