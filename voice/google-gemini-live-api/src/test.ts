/**
 * Gemini Live API TTS Test Suite
 * 
 * This file contains comprehensive tests for the Gemini Live API Text-to-Speech functionality.
 * 
 * USAGE:
 * 
 * 1. Simple Test (Quick):
 *    npm run test:simple
 *    or
 *    npx tsx test.ts simple
 * 
 * 2. Comprehensive Test (Full):
 *    npm run test:comprehensive
 *    or
 *    npx tsx test.ts comprehensive
 *    or
 *    npx tsx test.ts
 * 
 * ENVIRONMENT SETUP:
 * 
 * 1. Set your API key:
 *    export GOOGLE_API_KEY="your-api-key-here"
 * 
 * 2. Or use the default test key (not recommended for production)
 * 
 * TEST FEATURES:
 * 
 * Simple Test:
 * - Basic connection test
 * - Single TTS call
 * - Basic error handling
 * 
 * Comprehensive Test:
 * - Connection state management
 * - Multiple TTS calls
 * - Long text handling
 * - Speaker switching
 * - Error handling
 * - Audio file saving
 * - Event monitoring
 * - Session management
 * 
 * OUTPUT:
 * - Console logs with emojis for easy reading
 * - Audio files saved as PCM format for verification
 * - Detailed test summary
 * 
 * @author Your Name
 * @version 1.0.0
 */

import { GeminiLiveVoice } from './gemini-live-voice';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Simple TTS Test - Quick and basic
 */
async function simpleTTSTest() {
  console.log('🚀 Starting Simple TTS Test...\n');

  const voice = new GeminiLiveVoice({
    apiKey: process.env.GOOGLE_API_KEY || "AIzaSyCmOPkFVqWBZAib9r-EG9N5h1_IIOwWvoc",
    model: "gemini-2.0-flash-exp",
    speaker: "Puck",
    debug: true,
  });

  try {
    await voice.connect();
    console.log('✅ Connected:', voice.isConnected());

    voice.on('speaking', ({ audio, audioData, sampleRate }) => {
      console.log('🎵 Audio received:', { sampleRate, audioLength: audioData?.length });
    });

    voice.on('error', (error) => {
      console.error('❌ Error:', error);
    });

    await voice.speak('Hello, this is a simple test of the Gemini Live API.');
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    await voice.disconnect();
    console.log('✅ Test completed!');
  }
}

/**
 * Comprehensive TTS Test for Gemini Live API
 */
async function runTTSTest() {
  console.log('🚀 Starting Comprehensive Gemini Live TTS Test...\n');

  const voice = new GeminiLiveVoice({
    apiKey: process.env.GOOGLE_API_KEY || "AIzaSyCmOPkFVqWBZAib9r-EG9N5h1_IIOwWvoc",
    model: "gemini-2.0-flash-exp",
    speaker: "Puck",
    debug: true,
  });

  try {
    // Test 1: Connection
    console.log('📡 Testing connection...');
    await voice.connect();
    console.log('✅ Connected:', voice.isConnected());
    console.log('🔗 Connection state:', voice.getConnectionState());

    // Test 2: Event listeners
    console.log('\n🎧 Setting up event listeners...');
    
    let audioReceived = false;
    let textReceived = false;
    let errorReceived = false;

    voice.on('speaking', ({ audio, audioData, sampleRate }) => {
      audioReceived = true;
      console.log('🎵 Received audio response:', { 
        sampleRate, 
        audioLength: audioData?.length,
        hasAudioData: !!audioData,
        hasBase64Audio: !!audio
      });

      // Save audio data to file for verification
      if (audioData) {
        const buffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
        const filename = `test-audio-${Date.now()}.pcm`;
        writeFileSync(join(process.cwd(), filename), buffer);
        console.log(`💾 Audio saved to: ${filename}`);
      }
    });

    voice.on('writing', ({ text, role }) => {
      textReceived = true;
      console.log('📝 Received text response:', { text, role });
    });

    voice.on('error', (error) => {
      errorReceived = true;
      console.error('❌ Error received:', error);
    });

    voice.on('session', (data) => {
      console.log('🔄 Session event:', data);
    });

    // Test 3: Basic TTS
    console.log('\n🗣️  Testing basic TTS...');
    await voice.speak('Hello, this is a test of the Gemini Live API. How are you today?');
    
    // Wait a bit for response
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Multiple TTS calls
    console.log('\n🗣️  Testing multiple TTS calls...');
    const testPhrases = [
      'This is the first phrase.',
      'This is the second phrase.',
      'This is the third phrase.'
    ];

    for (const phrase of testPhrases) {
      console.log(`\n🎤 Speaking: "${phrase}"`);
      await voice.speak(phrase);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Test 5: Long text
    console.log('\n🗣️  Testing long text...');
    const longText = `This is a longer piece of text to test how the Gemini Live API handles more substantial content. 
    It includes multiple sentences and should demonstrate the API's ability to process and convert longer text inputs into speech. 
    The response should be smooth and natural-sounding.`;
    
    await voice.speak(longText);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 6: Different speaker (if supported)
    console.log('\n🗣️  Testing different speaker...');
    try {
      await voice.updateSessionConfig({ speaker: 'Charon' });
      await voice.speak('This is a test with a different speaker.');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('⚠️  Speaker change not supported or failed:', error instanceof Error ? error.message : String(error));
    }

    // Test 7: Error handling
    console.log('\n🧪 Testing error handling...');
    try {
      await voice.speak(''); // Empty string should be handled
      console.log('✅ Empty string handled gracefully');
    } catch (error) {
      console.log('⚠️  Empty string error:', error instanceof Error ? error.message : String(error));
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('✅ Connection:', voice.isConnected());
    console.log('✅ Audio received:', audioReceived);
    console.log('✅ Text received:', textReceived);
    console.log('❌ Errors received:', errorReceived);

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await voice.disconnect();
    console.log('✅ Disconnected:', !voice.isConnected());
    console.log('\n🎉 TTS test completed!');
  }
}

// Check command line arguments to determine which test to run
const args = process.argv.slice(2);
const testType = args[0] || 'comprehensive';

if (testType === 'simple') {
  simpleTTSTest().catch(console.error);
} else {
  runTTSTest().catch(console.error);
}