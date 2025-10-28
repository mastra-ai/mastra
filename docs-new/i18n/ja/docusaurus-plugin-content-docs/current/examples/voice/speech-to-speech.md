---
title: 音声対話
description: Mastra を使って音声対音声のアプリケーションを作成する例。
---

# Mastra を使った通話分析 \{#call-analysis-with-mastra\}

このガイドでは、Mastra を用いて分析機能を備えた完全な音声会話システムを構築する方法を解説します。例では、リアルタイムの音声対話、録音の管理、そして通話分析のための Roark Analytics との連携を含みます。

## 概要 \{#overview\}

このシステムは、Mastra エージェントと音声で対話し、その全過程を録音して Cloudinary に保存用としてアップロードし、その後、詳細な通話分析のために会話データを Roark Analytics に送信します。

## 設定 \{#setup\}

### 前提条件 \{#prerequisites\}

1. 音声認識・音声合成に必要な OpenAI API キー
2. 音声ファイル保存用の Cloudinary アカウント
3. 通話分析用の Roark Analytics API キー

### 環境構成 \{#environment-configuration\}

提供されたサンプルを基に、`.env` ファイルを作成します:

```bash filename="speech-to-speech/call-analysis/sample.env" copy
OPENAI_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ROARK_API_KEY=
```

### インストール \{#installation\}

必要な依存関係をインストールします：

```bash copy
npm install
```

## 実装 \{#implementation\}

### Mastra エージェントの作成 \{#creating-the-mastra-agent\}

まず、音声対応のエージェントを定義します。

```ts filename="speech-to-speech/call-analysis/src/mastra/agents/index.ts" copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { z } from 'zod';

// エージェントに何かさせる
export const speechToSpeechServer = new Agent({
  name: 'mastra',
  instructions: 'あなたは親切なアシスタントです。',
  voice: new OpenAIRealtimeVoice(),
  model: openai('gpt-4o'),
  tools: {
    salutationTool: createTool({
      id: 'salutationTool',
      description: 'ツールの結果を読み上げる',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ message: z.string() }),
      execute: async ({ context }) => {
        return { message: `こんにちは、${context.name}さん！` };
      },
    }),
  },
});
```

### Mastra の初期化 \{#initializing-mastra\}

Mastra にエージェントを登録します：

```ts filename="speech-to-speech/call-analysis/src/mastra/index.ts" copy
import { Mastra } from '@mastra/core';
import { speechToSpeechServer } from './agents';

export const mastra = new Mastra({
  agents: {
    speechToSpeechServer,
  },
});
```

### 音声保存のための Cloudinary 連携 \{#cloudinary-integration-for-audio-storage\}

録音した音声ファイルを保存できるように、Cloudinary を設定します。

```ts filename="speech-to-speech/call-analysis/src/upload.ts" copy
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(path: string) {
  const response = await cloudinary.uploader.upload(path, {
    resource_type: 'raw',
  });
  console.log(response);
  return response.url;
}
```

### メインアプリケーションのロジック \{#main-application-logic\}

メインアプリケーションは、会話フロー、録音、アナリティクスの統合を統括します。

```ts filename="speech-to-speech/call-analysis/src/base.ts" copy
import { Roark } from '@roarkanalytics/sdk';
import chalk from 'chalk';

import { mastra } from './mastra';
import { createConversation, formatToolInvocations } from './utils';
import { uploadToCloudinary } from './upload';
import fs from 'fs';

const client = new Roark({
  bearerToken: process.env.ROARK_API_KEY,
});

async function speechToSpeechServerExample() {
  const { start, stop } = createConversation({
    mastra,
    recordingPath: './speech-to-speech-server.mp3',
    providerOptions: {},
    initialMessage: 'やあ、相棒',
    onConversationEnd: async props => {
      // ファイルをアップロード
      fs.writeFileSync(props.recordingPath, props.audioBuffer);
      const url = await uploadToCloudinary(props.recordingPath);

      // Roark に送信
      console.log('Roark に送信:', url);
      const response = await client.callAnalysis.create({
        recordingUrl: url,
        startedAt: props.startedAt,
        callDirection: 'INBOUND',
        interfaceType: 'PHONE',
        participants: [
          {
            role: 'AGENT',
            spokeFirst: props.agent.spokeFirst,
            name: props.agent.name,
            phoneNumber: props.agent.phoneNumber,
          },
          {
            role: 'CUSTOMER',
            name: 'Yujohn Nattrass',
            phoneNumber: '987654321',
          },
        ],
        properties: props.metadata,
        toolInvocations: formatToolInvocations(props.toolInvocations),
      });

      console.log('通話録音を送信しました:', response.data);
    },
    onWriting: ev => {
      if (ev.role === 'assistant') {
        process.stdout.write(chalk.blue(ev.text));
      }
    },
  });

  await start();

  process.on('SIGINT', async e => {
    await stop();
  });
}

speechToSpeechServerExample().catch(console.error);
```

## 会話ユーティリティ \{#conversation-utilities\}

`utils.ts` ファイルには、会話を管理するためのヘルパー関数が含まれており、以下を行います：

1. 会話セッションの作成と管理
2. 音声録音の取り扱い
3. ツール呼び出しの処理
4. 会話ライフサイクルイベントの管理

## 例を実行する \{#running-the-example\}

次のように会話を開始します：

```bash copy
npm run dev
```

アプリケーションは次の処理を行います:

1. Mastra エージェントとのリアルタイム音声通話を開始する
2. 会話全体を録音する
3. 会話終了時に録音を Cloudinary にアップロードする
4. 分析のために会話データを Roark Analytics に送信する
5. 分析結果を表示する

## 主な機能 \{#key-features\}

* **リアルタイム音声対話**: OpenAIの音声モデルで自然な会話を実現
* **会話録音**: 後から分析できるように会話全体を記録
* **ツール呼び出しの追跡**: 会話中にAIツールがいつどのように使われたかを記録
* **アナリティクス連携**: 詳細分析のために会話データをRoark Analyticsに送信
* **クラウドストレージ**: 録音をCloudinaryにアップロードし、安全に保管・アクセス

## カスタマイズ \{#customization\}

このサンプルは次の方法でカスタマイズできます:

* エージェントの指示内容や機能を変更する
* エージェントが使うツールを追加する
* 会話の流れや初期メッセージを変更する
* カスタムメタデータによってアナリティクス連携を拡張する

完全なサンプルコードは [GitHub リポジトリ](https://github.com/mastra-ai/voice-examples/tree/main/speech-to-speech/call-analysis)をご覧ください。

<br />

<br />

<GithubLink link="https://github.com/mastra-ai/voice-examples/tree/main/speech-to-speech/call-analysis" />