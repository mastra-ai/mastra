---
title: 'voice.getSpeakers() '
description: 'Documentation for the getSpeakers() method available in voice providers, which retrieves available voice options.'
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# voice.getSpeakers()

The `getSpeakers()` method retrieves a list of available voice options (speakers) from the voice provider. This allows applications to present users with voice choices or programmatically select the most appropriate voice for different contexts.

## Usage Example

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';
import { ElevenLabsVoice } from '@mastra/voice-elevenlabs';

// Initialize voice providers
const openaiVoice = new OpenAIVoice();
const elevenLabsVoice = new ElevenLabsVoice({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Get available speakers from OpenAI
const openaiSpeakers = await openaiVoice.getSpeakers();
console.log('OpenAI voices:', openaiSpeakers);
// Example output: [{ voiceId: "alloy" }, { voiceId: "echo" }, { voiceId: "fable" }, ...]

// Get available speakers from ElevenLabs
const elevenLabsSpeakers = await elevenLabsVoice.getSpeakers();
console.log('ElevenLabs voices:', elevenLabsSpeakers);
// Example output: [{ voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" }, ...]

// Use a specific voice for speech
const text = 'Hello, this is a test of different voices.';
await openaiVoice.speak(text, { speaker: openaiSpeakers[2].voiceId });
await elevenLabsVoice.speak(text, { speaker: elevenLabsSpeakers[0].voiceId });
```

## Parameters

This method does not accept any parameters.

## Return Value

<PropertiesTable
content={[
{
name: "Promise<Array<{ voiceId: string } & TSpeakerMetadata>>",
type: "Promise",
description:
"A promise that resolves to an array of voice options, where each option contains at least a voiceId property and may include additional provider-specific metadata.",
},
]}
/>

## Provider-Specific Metadata

Different voice providers return different metadata for their voices:

<Tabs>
  <TabItem value="openai" label="OpenAI">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice (e.g., 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer')",
        }
      ]}
    />
  </TabItem>

  <TabItem value="openai-realtime" label="OpenAI Realtime">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description:
            "Unique identifier for the voice (e.g., 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer')",
        },
      ]}
    />
  </TabItem>

  <TabItem value="deepgram" label="Deepgram">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "language",
          type: "string",
          description: "Language code embedded in the voice ID (e.g., 'en')",
        },
      ]}
    />
  </TabItem>

  <TabItem value="elevenlabs" label="ElevenLabs">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "name",
          type: "string",
          description: "Human-readable name of the voice",
        },
        {
          name: "category",
          type: "string",
          description: "Category of the voice (e.g., 'premade', 'cloned')",
        },
      ]}
    />
  </TabItem>

  <TabItem value="google" label="Google">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "languageCodes",
          type: "string[]",
          description:
            "Array of language codes supported by the voice (e.g., ['en-US'])",
        },
      ]}
    />
  </TabItem>

  <TabItem value="azure" label="Azure">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "language",
          type: "string",
          description: "Language code extracted from the voice ID (e.g., 'en')",
        },
        {
          name: "region",
          type: "string",
          description: "Region code extracted from the voice ID (e.g., 'US')",
        },
      ]}
    />
  </TabItem>

  <TabItem value="murf" label="Murf">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "name",
          type: "string",
          description: "Name of the voice (same as voiceId)",
        },
        {
          name: "language",
          type: "string",
          description: "Language code extracted from the voice ID (e.g., 'en')",
        },
        {
          name: "gender",
          type: "string",
          description:
            "Gender of the voice (always 'neutral' in current implementation)",
        },
      ]}
    />
  </TabItem>

  <TabItem value="playai" label="PlayAI">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description:
            "Unique identifier for the voice (S3 URL to manifest.json)",
        },
        {
          name: "name",
          type: "string",
          description:
            "Human-readable name of the voice (e.g., 'Angelo', 'Arsenio')",
        },
        {
          name: "accent",
          type: "string",
          description:
            "Accent of the voice (e.g., 'US', 'Irish', 'US African American')",
        },
        {
          name: "gender",
          type: "string",
          description: "Gender of the voice ('M' or 'F')",
        },
        {
          name: "age",
          type: "string",
          description: "Age category of the voice (e.g., 'Young', 'Middle')",
        },
        {
          name: "style",
          type: "string",
          description: "Speaking style of the voice (e.g., 'Conversational')",
        },
      ]}
    />
  </TabItem>

  <TabItem value="speechify" label="Speechify">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "name",
          type: "string",
          description: "Human-readable name of the voice",
        },
        {
          name: "language",
          type: "string",
          description: "Language code of the voice (e.g., 'en-US')",
        },
      ]}
    />
  </TabItem>

  <TabItem value="sarvam" label="Sarvam">
    <PropertiesTable
      content={[
        {
          name: "voiceId",
          type: "string",
          description: "Unique identifier for the voice",
        },
        {
          name: "name",
          type: "string",
          description: "Human-readable name of the voice",
        },
        {
          name: "language",
          type: "string",
          description: "Language of the voice (e.g., 'english', 'hindi')",
        },
        {
          name: "gender",
          type: "string",
          description: "Gender of the voice ('male' or 'female')",
        }
      ]}
    />
  </TabItem>
</Tabs>

## Notes

- The available voices vary significantly between providers
- Some providers may require authentication to retrieve the full list of voices
- The default implementation returns an empty array if the provider doesn't support this method
- For performance reasons, consider caching the results if you need to display the list frequently
- The `voiceId` property is guaranteed to be present for all providers, but additional metadata varies
