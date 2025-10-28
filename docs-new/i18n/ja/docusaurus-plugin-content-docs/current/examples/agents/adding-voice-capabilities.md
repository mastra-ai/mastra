---
title: "音声機能の追加"
description: "Mastra エージェントに音声機能を追加し、さまざまな音声プロバイダーを使って話したり聞いたりできるようにする例。"
---

# エージェントに音声機能を持たせる \{#giving-your-agent-a-voice\}

Mastra のエージェントは音声機能を追加でき、話すことも聞くことも可能です。この例では、音声機能を設定する2つの方法を示します。

1. 入力と出力のストリームを分ける複合的な音声セットアップを使用する方法
2. 両方をまとめて処理する統合型の音声プロバイダーを使用する方法

どちらの例でも、デモ目的で `OpenAIVoice` プロバイダーを使用します。

## 前提条件 \{#prerequisites\}

この例では `openai` モデルを使用します。`.env` ファイルに `OPENAI_API_KEY` を追加してください。

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

## インストール \{#installation\}

```bash
npm install @mastra/voice-openai
```

## ハイブリッド音声エージェント \{#hybrid-voice-agent\}

このエージェントは、音声認識（speech-to-text）と音声合成（text-to-speech）を切り分けた複合的な音声構成を使用します。`CompositeVoice` を使うと、聞き取り（入力）と発話（出力）で異なるプロバイダーを設定できます。ただし、この例ではどちらも同じプロバイダーである `OpenAIVoice` が処理します。

```typescript filename="src/mastra/agents/example-hybrid-voice-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIVoice } from '@mastra/voice-openai';
import { openai } from '@ai-sdk/openai';

export const hybridVoiceAgent = new Agent({
  name: 'hybrid-voice-agent',
  model: openai('gpt-4o'),
  instructions: '異なるプロバイダーを使って音声の入出力ができます。',
  voice: new CompositeVoice({
    input: new OpenAIVoice(),
    output: new OpenAIVoice(),
  }),
});
```

> 構成オプションの一覧については、[Agent](/docs/reference/agents/agent)を参照してください。

## 統合型音声エージェント \{#unified-voice-agent\}

このエージェントは、音声認識（speech-to-text）と音声合成（text-to-speech）の両方に単一の音声プロバイダーを使用します。聞き取りと発話の両方に同じプロバイダーを使う場合は、より簡潔なセットアップになります。この例では、`OpenAIVoice` プロバイダーが両方の機能を担います。

```typescript filename="src/mastra/agents/example-unified-voice-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { OpenAIVoice } from '@mastra/voice-openai';

export const unifiedVoiceAgent = new Agent({
  name: 'unified-voice-agent',
  instructions: 'あなたは音声認識（STT）と音声合成（TTS）の両方の機能を持つエージェントです。',
  model: openai('gpt-4o'),
  voice: new OpenAIVoice(),
});
```

> 設定項目の一覧については、[Agent](/docs/reference/agents/agent)を参照してください。

## エージェントの登録 \{#registering-agents\}

これらのエージェントを使用するには、メインの Mastra インスタンスに登録します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { hybridVoiceAgent } from './agents/example-hybrid-voice-agent';
import { unifiedVoiceAgent } from './agents/example-unified-voice-agent';

export const mastra = new Mastra({
  // ...
  agents: { hybridVoiceAgent, unifiedVoiceAgent },
});
```

## 関数 \{#functions\}

これらのヘルパー関数は、音声対話の例で、音声ファイルの操作やテキスト変換を行います。

### `saveAudioToFile` \{#saveaudiotofile\}

この関数は、オーディオ用ディレクトリに音声ストリームをファイルとして保存し、ディレクトリが存在しない場合は作成します。

```typescript filename="src/mastra/utils/save-audio-to-file.ts" showLineNumbers copy
import fs, { createWriteStream } from 'fs';
import path from 'path';

export const saveAudioToFile = async (audio: NodeJS.ReadableStream, filename: string): Promise<void> => {
  const audioDir = path.join(process.cwd(), 'audio');
  const filePath = path.join(audioDir, filename);

  await fs.promises.mkdir(audioDir, { recursive: true });

  const writer = createWriteStream(filePath);
  audio.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};
```

### `convertToText` \{#converttotext\}

この関数は、文字列または読み取り可能なストリームをテキストに変換し、音声処理での両方の入力タイプに対応します。

```typescript filename="src/mastra/utils/convert-to-text.ts" showLineNumbers copy
export const convertToText = async (input: string | NodeJS.ReadableStream): Promise<string> => {
  if (typeof input === 'string') {
    return input;
  }

  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    input.on('data', chunk => chunks.push(Buffer.from(chunk)));
    input.on('error', reject);
    input.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
};
```

## 使用例 \{#example-usage\}

この例では、2つのエージェント間の音声対話を示します。Hybrid voice agent が質問を音声で発話し、音声ファイルとして保存します。Unified voice agent はそのファイルを再生して内容を認識し、質問を処理して応答を生成し、音声で返答します。両方の音声出力は `audio` ディレクトリに保存されます。

作成されるファイルは次のとおりです:

* **hybrid-question.mp3** – Hybrid agent が発話した質問。
* **unified-response.mp3** – Unified agent が発話した応答。

```typescript filename="src/test-voice-agents.ts" showLineNumbers copy
import 'dotenv/config';

import path from 'path';
import { createReadStream } from 'fs';
import { mastra } from './mastra';

import { saveAudioToFile } from './mastra/utils/save-audio-to-file';
import { convertToText } from './mastra/utils/convert-to-text';

const hybridVoiceAgent = mastra.getAgent('hybridVoiceAgent');
const unifiedVoiceAgent = mastra.getAgent('unifiedVoiceAgent');

const question = '人生の意味を一文で教えてください。';

const hybridSpoken = await hybridVoiceAgent.voice.speak(question);

await saveAudioToFile(hybridSpoken!, 'hybrid-question.mp3');

const audioStream = createReadStream(path.join(process.cwd(), 'audio', 'hybrid-question.mp3'));
const unifiedHeard = await unifiedVoiceAgent.voice.listen(audioStream);

const inputText = await convertToText(unifiedHeard!);

const unifiedResponse = await unifiedVoiceAgent.generate(inputText);
const unifiedSpoken = await unifiedVoiceAgent.voice.speak(unifiedResponse.text);

await saveAudioToFile(unifiedSpoken!, 'unified-response.mp3');
```

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/agents/voice-capabilities" />

## 関連項目 \{#related\}

* [エージェントの呼び出し](./calling-agents#from-the-command-line)