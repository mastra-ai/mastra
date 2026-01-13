/**
 * Local WebSocket test for Twilio Voice Agent
 *
 * This script simulates Twilio Media Streams to test the server locally
 * without needing a real phone call.
 *
 * Usage: npx tsx src/test-local.ts
 */

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000/media-stream';

console.log(`🔌 Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected!');

  // Simulate Twilio "connected" event
  ws.send(
    JSON.stringify({
      event: 'connected',
      protocol: 'Call',
      version: '1.0.0',
    }),
  );

  // Simulate Twilio "start" event with call metadata
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        event: 'start',
        sequenceNumber: '1',
        start: {
          streamSid: 'MZ_TEST_' + Date.now(),
          accountSid: 'AC_TEST',
          callSid: 'CA_TEST_' + Date.now(),
          tracks: ['inbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1,
          },
        },
        streamSid: 'MZ_TEST_' + Date.now(),
      }),
    );
    console.log('📞 Simulated call start');
  }, 100);

  // You could also simulate audio here by sending media events
  // with base64-encoded mulaw audio
});

ws.on('message', (data: Buffer) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.event === 'media') {
      console.log('🔊 Received audio from server');
    } else {
      console.log('📩 Received:', message.event || message);
    }
  } catch {
    console.log('📩 Received raw:', data.toString().substring(0, 100));
  }
});

ws.on('error', (error: Error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
  process.exit(0);
});

// Keep the connection open
console.log('Press Ctrl+C to exit');

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  ws.close();
});
