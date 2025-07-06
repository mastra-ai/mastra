import { GoogleLiveAPI } from '@mastra/voice-google-live';

import wav from 'wav';

const main = async () => {
  const voice = new GoogleLiveAPI({
    chatModel: {
      apiKey: '', // Make sure to set your Google API key
    },
  });
  voice.on('connection', e => {
    console.log('->', e);
  });

  voice.on('error', error => {
    console.error('Error:', error);
  });

  await voice.connect();

  // Initialize WAV file writer
  const timeID = new Date().getTime();
  let audioWriter = new wav.FileWriter(`audio${timeID}.wav`, {
    channels: 1,
    sampleRate: 24000,
    bitDepth: 16,
  });

  voice.on('speaking', ({ audioBuffer }) => {
    audioWriter.write(audioBuffer);
  });

  voice.on('speaking:completed', () => {
    //console.log('speaking completed');
    if (audioWriter) {
      audioWriter.end();
    }
    voice.close();
  });

  voice.on('writing', ({ text }) => {
    console.log(text);
  });

  await voice.speak('Hello! I am Mastra Google Live API');

  //voice.close();
};

main();
