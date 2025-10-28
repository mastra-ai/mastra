---
title: "音声認識（音声→テキスト）"
description: Mastra を使用して音声をテキスト化するアプリケーションを作成する例。
---

# スマート音声メモアプリ \{#smart-voice-memo-app\}

以下のコードスニペットは、Next.js に Mastra を直接統合したスマート音声メモアプリにおける Speech-to-Text（STT）機能の実装例です。Next.js への Mastra の統合の詳細は、[Next.js と統合する](/docs/frameworks/web-frameworks/next-js) をご覧ください。

## STT 機能を備えたエージェントの作成 \{#creating-an-agent-with-stt-capabilities\}

次の例では、OpenAI の STT 機能を用いて音声対応エージェントを初期化する方法を示します。

```typescript filename="src/mastra/agents/index.ts"
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { OpenAIVoice } from '@mastra/voice-openai';

const instructions = `
あなたは、コンテンツの簡潔で構造化された要約を提供するAIノートアシスタントです... // 簡潔にするため省略
`;

export const noteTakerAgent = new Agent({
  name: 'ノート作成エージェント',
  instructions: instructions,
  model: openai('gpt-4o'),
  voice: new OpenAIVoice(), // デフォルト設定でOpenAI音声プロバイダーを追加
});
```

## Mastra へのエージェント登録 \{#registering-the-agent-with-mastra\}

このスニペットは、STT 対応エージェントを Mastra インスタンスに登録する方法を示します。

```typescript filename="src/mastra/index.ts"
import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';

import { noteTakerAgent } from './agents';

export const mastra = new Mastra({
  agents: { noteTakerAgent }, // ノートテイカーエージェントを登録
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## 書き起こしのための音声処理 \{#processing-audio-for-transcription\}

次のコードは、Webリクエストで受け取った音声をエージェントのSTT機能で書き起こす方法を示しています。

```typescript filename="app/api/audio/route.ts"
import { mastra } from './mastra'; // Mastraインスタンスをインポート
import { Readable } from 'node:stream';

export async function POST(req: Request) {
  // リクエストから音声ファイルを取得
  const formData = await req.formData();
  const audioFile = formData.get('audio') as File;
  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const readable = Readable.from(buffer);

  // Mastraインスタンスからノートテイカーエージェントを取得
  const noteTakerAgent = mastra.getAgent('noteTakerAgent');

  // 音声ファイルを文字起こし
  const text = await noteTakerAgent.voice?.listen(readable);

  return new Response(JSON.stringify({ text }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Smart Voice Memo App の完全な実装は、当社の GitHub リポジトリでご覧いただけます。

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/voice-examples/tree/main/speech-to-text/voice-memo-app"
}
/>
