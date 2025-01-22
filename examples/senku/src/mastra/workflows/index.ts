import { MastraVector, Step, Workflow } from '@mastra/core';
import { ElevenLabsTTS } from '@mastra/tts';
import { writeFileSync } from 'fs';
import pLimit from 'p-limit';
import path from 'path';
import { z } from 'zod';

import { mkdir, readdir, rm } from 'fs/promises';

import { getChannelMessagesTool, listChannelsTool, scrapeWebsiteTool } from '../tools';
import { concatAudio, generateAudio, playAudio } from '../tts';
import { insertDocument } from '../vectors';

const getSlackMessages = new Step({
  id: 'get-slack-messages',
  description: 'Gets messages from Slack channel',
  inputSchema: z.object({
    token: z.string().describe('Slack API token'),
    channelName: z.string().describe('Channel name to fetch from'),
    limit: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    messages: z.array(z.any()),
  }),
  execute: async ({ context: { token, channelName, limit } }) => {
    console.log('---------------------------');
    console.log('Getting messages from Slack channel', { channelName });
    if (!token) {
      throw new Error('Please set SLACK_TOKEN environment variable');
    }
    const channels = await listChannelsTool.execute({
      context: { token },
      suspend: async () => {},
    });

    const targetChannel = channels.channels.find(channel => channel.name === channelName);
    if (!targetChannel) {
      throw new Error(`Channel ${channelName} not found`);
    }

    const messages = await getChannelMessagesTool.execute({
      context: {
        token,
        channelId: targetChannel.id,
        limit,
      },
      suspend: async () => {},
    });

    const filteredMessages = messages.messages.filter(message => !!message.originalUrl);

    return { messages: filteredMessages };
  },
});

const scrapeContent = new Step({
  id: 'scrape-content',
  description: 'Scrapes content from URLs in messages',
  inputSchema: z.object({
    messages: z.array(z.any()),
  }),
  outputSchema: z.object({
    content: z.object({
      content: z.string(),
      title: z.string(),
      url: z.string(),
    }),
  }),
  execute: async ({ context: { messages } }) => {
    const message = messages[1]; // Or implement message selection logic
    const urlMatch = message.text.match(/<(https?:\/\/[^>]+)>/) || message.originalUrl?.match(/<(https?:\/\/[^>]+)>/);

    if (!urlMatch) {
      throw new Error('No URL found in message');
    }

    const content = await scrapeWebsiteTool.execute({
      context: { url: urlMatch[1] },
      suspend: async () => {},
    });

    return { content };
  },
});

const embedContent = new Step({
  id: 'embed-content',
  description: 'Creates and stores embeddings from scraped content',
  inputSchema: z.object({
    content: z.object({
      content: z.string(),
      title: z.string(),
      url: z.string(),
    }),
  }),
  execute: async ({ context: { content }, mastra }) => {
    console.log('---------------------------');
    console.log('Embedding content');

    const vectorStore = mastra?.vectors?.pgVector as MastraVector;
    await insertDocument(content, vectorStore);
  },
});

const analyzeContent = new Step({
  id: 'analyze-content',
  description: 'Analyzes the PDF content and creates summary',
  outputSchema: z.object({
    podcastScript: z.string(),
  }),
  execute: async ({ mastra }) => {
    console.log('---------------------------');
    console.log('Analyzing content');
    const agent = mastra?.agents?.whitePaperAgent;

    const analysisPrompt = `Use the graphRagTool to query the vector store and create an engaging podcast episode about this research paper.

    Create a podcast script that includes:
    - An engaging intro ("Welcome to WhiteSpace, the podcast that breaks down complex research papers...")
    - A brief overview of the paper's topic and why it matters
    - Key findings explained in a conversational tone
    - Real-world implications and applications
    - A compelling outro with key takeaways
    - Have two podcast hosts (Dane and Shane) discuss the findings of the paper.
    - Have witty banter between the two hosts.

    Notes: 
    - The podcast script should be in the following format:
    - HOST_A: Welcome to WhiteSpace! I'm your host Alex.
    - HOST_B: And I'm Taylor. Today we're diving into an fascinating paper about...
    - HOST_A: Let me break down the main findings...

    Keep the tone friendly and accessible, as if explaining to an interested non-expert. 
    Use natural, conversational language throughout. When technical terms are necessary, explain them clearly.
    Aim for a 3-5 minute podcast length.
    Do not include any text not related to the podcast script.
    `;

    const result = await agent?.generate(analysisPrompt);

    return {
      podcastScript: result?.text ?? '',
    };
  },
});

const addPodcastAudio = new Step({
  id: 'add-podcast-audio',
  description: 'Creates multi-voice podcast audio',
  inputSchema: z.object({
    podcastScript: z.string().describe('The podcast script'),
  }),
  execute: async ({ context: { podcastScript }, mastra }) => {
    console.log('---------------------------');
    console.log(podcastScript);

    const segments = podcastScript
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [speaker, ...textParts] = line.split(':');
        return {
          speaker: speaker.trim(),
          text: textParts.join(':').trim(),
        };
      });

    const tts = new ElevenLabsTTS({
      model: {
        name: 'eleven_multilingual_v2',
        apiKey: process.env.ELEVENLABS_API_KEY!,
      },
    });

    const voices = await tts.voices();

    try {
      await rm('audio', { recursive: true, force: true });
      await mkdir('audio', { recursive: true });
      const limit = pLimit(3); // Limit to 3 concurrent requests

      const audioPromises = segments.map(({ speaker, text }, index) =>
        limit(async () => {
          const voiceName = speaker === 'DANE' ? 'Daniel' : 'Bill';
          const voiceId = voices?.find(voice => voice.name === voiceName)?.voice_id;

          if (!voiceId) {
            console.error(`Voice not found for ${voiceName}`);
            return;
          }

          const paddedIndex = String(index).padStart(3, '0');
          console.log('Generating audio for segment', paddedIndex);
          await generateAudio(tts, text, voiceId, paddedIndex);
        }),
      );

      await Promise.all(audioPromises);
    } catch (error) {
      console.error('Error in audio generation:', error);
      throw error;
    }

    try {
      const files = (await readdir('audio'))
        .filter(f => f.startsWith('voice-'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        })
        .map(f => path.join(process.cwd(), 'audio', f));
      const fileList = files
        .map((file, index) => {
          let fileString = `file '${file}'`;

          return fileString;
        })
        .join('\n');
      writeFileSync('audio/filelist.txt', fileList);
      await concatAudio('audio/filelist.txt', 'audio/podcast.mp3');
      await playAudio('audio/podcast.mp3');
    } catch (error) {
      console.error('Error in audio playback:', error);
      throw error;
    }
  },
});

const whitePaperWorkflow = new Workflow({
  name: 'whitePaperWorkflow',
  triggerSchema: z.object({
    token: z.string().describe('Slack API token'),
    channelName: z.string().describe('Slack channel name'),
    limit: z.number().optional().default(10),
  }),
})
  .step(getSlackMessages, {
    variables: {
      token: { step: 'trigger', path: 'token' },
      channelName: { step: 'trigger', path: 'channelName' },
      limit: { step: 'trigger', path: 'limit' },
    },
  })
  .then(scrapeContent, {
    variables: {
      messages: { step: getSlackMessages, path: 'messages' },
    },
  })
  .then(embedContent, {
    variables: {
      content: { step: scrapeContent, path: 'content' },
    },
  })
  .then(analyzeContent)
  .then(addPodcastAudio, {
    variables: {
      podcastScript: {
        step: analyzeContent,
        path: 'podcastScript',
      },
    },
  });

whitePaperWorkflow.commit();

export { whitePaperWorkflow };
