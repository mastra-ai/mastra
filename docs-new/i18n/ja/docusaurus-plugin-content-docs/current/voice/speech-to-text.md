---
title: 音声認識（Speech-to-Text）
description: Mastra における音声認識（Speech-to-Text）の機能概要。設定、利用方法、音声プロバイダーとの連携について解説します。
sidebar_position: 3
---

# 音声認識（STT） \{#speech-to-text-stt\}

Mastra の音声認識（STT）は、複数のサービスプロバイダーに対応し、音声入力をテキストに変換するための標準化インターフェースを提供します。
STT は、人の発話に応答できる音声対応アプリケーションの開発を支援し、ハンズフリー操作、障害のあるユーザーの利便性向上、より自然な人間とコンピューターのインターフェースを実現します。

## 設定 \{#configuration\}

Mastra で STT を使うには、音声プロバイダーを初期化する際に `listeningModel` を指定します。含まれる主なパラメータは次のとおりです。

* **`name`**: 使用する STT モデル名
* **`apiKey`**: 認証に使用する API キー
* **プロバイダー固有のオプション**: 利用する音声プロバイダーで必要またはサポートされる追加オプション

**注意**: これらのパラメータはすべて省略可能です。利用中のプロバイダーに応じて、音声プロバイダーが提供する既定設定をそのまま使用できます。

```typescript
const voice = new OpenAIVoice({
  listeningModel: {
    name: 'whisper-1',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// 既定の設定を使用する場合、設定は次のように簡略化できます:
const voice = new OpenAIVoice();
```

## 利用可能なプロバイダー \{#available-providers\}

Mastra は複数の音声認識（Speech-to-Text）プロバイダーをサポートしており、それぞれに独自の機能と強みがあります。

* [**OpenAI**](/docs/reference/voice/openai/) - Whisper モデルによる高精度な文字起こし
* [**Azure**](/docs/reference/voice/azure/) - エンタープライズ級の信頼性を備えた Microsoft の音声認識
* [**ElevenLabs**](/docs/reference/voice/elevenlabs/) - 複数言語対応の高度な音声認識
* [**Google**](/docs/reference/voice/google/) - 幅広い言語をサポートする Google の音声認識
* [**Cloudflare**](/docs/reference/voice/cloudflare/) - 低レイテンシ用途向けにエッジ最適化された音声認識
* [**Deepgram**](/docs/reference/voice/deepgram/) - 多様なアクセントにも高精度で対応する AI 駆動の音声認識
* [**Sarvam**](/docs/reference/voice/sarvam/) - インド系言語とアクセントに特化

各プロバイダーは、必要に応じてインストール可能な個別パッケージとして提供されています。

```bash
pnpm add @mastra/voice-openai  # OpenAI の例
```

## Listen メソッドの使用 \{#using-the-listen-method\}

STT の主要な手段は `listen()` メソッドで、音声をテキストに変換します。使い方は次のとおりです。

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { OpenAIVoice } from '@mastra/voice-openai';
import { getMicrophoneStream } from '@mastra/node-audio';

const voice = new OpenAIVoice();

const agent = new Agent({
  name: '音声エージェント',
  instructions: 'あなたは、ユーザー入力に基づいておすすめを提供する音声アシスタントです。',
  model: openai('gpt-4o'),
  voice,
});

const audioStream = getMicrophoneStream(); // この関数が音声入力を取得すると仮定

const transcript = await agent.voice.listen(audioStream, {
  filetype: 'm4a', // 任意: 音声ファイルの種類を指定
});

console.log(`ユーザーの発話内容: ${transcript}`);

const { text } = await agent.generate(`ユーザーの発話に基づいて、おすすめを提供してください: ${transcript}`);

console.log(`おすすめ: ${text}`);
```

エージェントでの STT の使い方は、[Adding Voice to Agents](../agents/adding-voice) のドキュメントをご覧ください。
