/**
 * Twilio Voice Agent Example
 *
 * This example demonstrates how to build an AI voice agent that handles
 * phone calls using Twilio Media Streams and OpenAI Realtime API.
 *
 * Setup:
 * 1. Set environment variables:
 *    - OPENAI_API_KEY
 *    - TWILIO_ACCOUNT_SID (optional, for validation)
 *    - TWILIO_AUTH_TOKEN (optional, for validation)
 *
 * 2. Run the server: pnpm dev
 *
 * 3. Expose to internet (for Twilio webhook):
 *    pnpm dev:tunnel
 *    or use ngrok: ngrok http 3000
 *
 * 4. Configure Twilio:
 *    - Go to your Twilio Phone Number settings
 *    - Set Voice webhook to: https://your-url/incoming-call
 *
 * Architecture:
 * - /incoming-call: HTTP webhook that returns TwiML to connect to Media Streams
 * - /media-stream: WebSocket endpoint for bidirectional audio streaming
 */

import { serve } from '@hono/node-server';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { TwilioVoice } from '@mastra/voice-twilio';
import type { TwilioCallMetadata } from '@mastra/voice-twilio';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { mastra } from './mastra';

const app = new Hono();
const PORT = process.env.PORT || 3000;

// Get the public URL for WebSocket connection
const PUBLIC_URL = process.env.PUBLIC_URL || `localhost:${PORT}`;
const WS_URL = PUBLIC_URL.startsWith('localhost')
  ? `ws://${PUBLIC_URL}/media-stream`
  : `wss://${PUBLIC_URL}/media-stream`;

/**
 * Health check endpoint
 */
app.get('/', (c: Context) => {
  return c.json({
    status: 'ok',
    message: 'Twilio Voice Agent Server',
    endpoints: {
      webhook: '/incoming-call',
      websocket: '/media-stream',
    },
  });
});

/**
 * Twilio Voice Webhook - Incoming Call Handler
 *
 * When someone calls your Twilio number, Twilio sends a request here.
 * We respond with TwiML that tells Twilio to connect the call to our
 * WebSocket Media Stream endpoint.
 */
app.post('/incoming-call', (c: Context) => {
  console.log('📞 Incoming call received');

  const twilioVoice = new TwilioVoice({
    websocketUrl: WS_URL,
  });

  const twiml = twilioVoice.generateTwiML();

  return c.text(twiml, 200, {
    'Content-Type': 'text/xml',
  });
});

/**
 * Start the HTTP server
 */
const server = serve({
  fetch: app.fetch,
  port: Number(PORT),
});

console.log(`🚀 Server running on http://localhost:${PORT}`);
console.log(`📱 Webhook URL: http://localhost:${PORT}/incoming-call`);
console.log(`🔌 WebSocket URL: ${WS_URL}`);

/**
 * WebSocket Server for Twilio Media Streams
 *
 * This handles the bidirectional audio streaming:
 * - Receives audio from the caller (mulaw format)
 * - Sends audio back to the caller (mulaw format)
 */
const wss = new WebSocketServer({
  server: server as any,
  path: '/media-stream',
});

wss.on('connection', async (ws: WebSocket) => {
  console.log('🔗 New WebSocket connection from Twilio');

  // Create voice providers for this call session
  const twilioVoice = new TwilioVoice({ debug: true });
  const openaiVoice = new OpenAIRealtimeVoice({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Get agent and configure OpenAI voice with tools/instructions
  const agent = mastra.getAgent('phoneAgent');
  const tools = await agent.listTools({});
  const instructions = await agent.getInstructions({});

  openaiVoice.addTools(tools);
  // Convert instructions to string if needed (may be string or SystemModelMessage)
  const instructionText = typeof instructions === 'string' ? instructions : undefined;
  openaiVoice.addInstructions(instructionText);

  let streamSid: string | undefined;

  /**
   * Handle messages from Twilio Media Streams
   */
  ws.on('message', async (data: Buffer) => {
    const message = data.toString();

    try {
      await twilioVoice.handleMessage(message);
    } catch (error) {
      console.error('Error handling Twilio message:', error);
    }
  });

  /**
   * When Twilio sends call metadata, register the connection and connect to OpenAI
   */
  twilioVoice.on('call-metadata', async (metadata: TwilioCallMetadata) => {
    console.log(`📞 Call started: ${metadata.callSid}`);
    streamSid = metadata.streamSid;

    // Register the WebSocket connection with TwilioVoice
    twilioVoice.registerConnection(streamSid, ws);

    // Connect to OpenAI Realtime API
    try {
      await openaiVoice.connect();
      console.log('🤖 Connected to OpenAI Realtime');

      // Send initial greeting
      await openaiVoice.speak('Hello! How can I help you today?');
    } catch (error) {
      console.error('Failed to connect to OpenAI:', error);
    }
  });

  /**
   * When we receive audio from the caller, send it to OpenAI
   */
  twilioVoice.on('audio-received', async ({ audio, streamSid }: { audio: Int16Array; streamSid: string }) => {
    // Audio is already converted to PCM by TwilioVoice
    // Send it to OpenAI Realtime for processing
    try {
      await openaiVoice.send(audio);
    } catch (error) {
      console.error('Error sending audio to OpenAI:', error);
    }
  });

  /**
   * When OpenAI generates audio response, send it back to the caller
   */
  openaiVoice.on('speaking', async ({ audio }: { audio?: Buffer }) => {
    if (streamSid && audio) {
      // Convert PCM audio from OpenAI to the format Twilio expects
      // TwilioVoice.sendAudio handles PCM -> mulaw conversion
      const pcmAudio = new Int16Array(audio.buffer, audio.byteOffset, audio.byteLength / 2);
      await twilioVoice.sendAudio(streamSid, pcmAudio);
    }
  });

  /**
   * Log transcriptions from OpenAI
   */
  openaiVoice.on('writing', ({ text, role }: { text: string; role: string }) => {
    if (text.trim()) {
      console.log(`💬 ${role}: ${text}`);
    }
  });

  /**
   * Handle call end
   */
  twilioVoice.on('call-ended', ({ callSid }: { callSid: string }) => {
    console.log(`📞 Call ended: ${callSid}`);
    openaiVoice.close();
  });

  /**
   * Handle WebSocket close
   */
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    twilioVoice.close();
    openaiVoice.close();
  });

  /**
   * Handle errors
   */
  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });

  twilioVoice.on('error', (error: Error) => {
    console.error('TwilioVoice error:', error);
  });

  openaiVoice.on('error', (error: Error) => {
    console.error('OpenAI error:', error);
  });
});

console.log('✅ WebSocket server ready for Twilio Media Streams');
