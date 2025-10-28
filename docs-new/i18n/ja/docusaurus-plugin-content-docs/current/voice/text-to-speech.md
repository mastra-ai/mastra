---
title: 音声合成
description: Mastra の音声合成機能の概要。設定、使用方法、音声プロバイダーとの連携について説明します。
sidebar_position: 2
---

# 音声合成（TTS） \{#text-to-speech-tts\}

Mastra の音声合成（TTS）は、複数のプロバイダーを活用してテキストから音声を生成するための統一 API を提供します。
アプリケーションに TTS を組み込むことで、自然な音声による対話でユーザー体験を向上させ、視覚に障がいのあるユーザーのアクセシビリティを高め、より魅力的なマルチモーダルなインターフェースを実現できます。

TTS はあらゆる音声アプリケーションの中核要素です。STT（Speech-to-Text）と組み合わせることで、音声対話システムの基盤を構築できます。さらに、新しいモデルは STS（[Speech-to-Speech](./speech-to-speech)）をサポートしており、リアルタイムの対話に利用可能ですが、コスト（$）が高くなります。

## 設定 \{#configuration\}

Mastra で TTS を使うには、ボイスプロバイダーを初期化する際に `speechModel` を指定します。これには次のパラメータが含まれます:

* **`name`**: 使用する TTS モデル。
* **`apiKey`**: 認証用の API キー。
* **プロバイダー固有のオプション**: 利用するボイスプロバイダーで必要またはサポートされる追加オプション。

**`speaker`** オプションでは、音声合成に使用するボイスを選択できます。各プロバイダーは、**Voice diversity**、**Quality**、**Voice personality**、**Multilingual support** といった特性の異なる多様なボイスを提供しています。

**注**: これらのパラメータはすべて任意です。使用するプロバイダーに応じて、ボイスプロバイダーのデフォルト設定をそのまま使用できます。

```typescript
const voice = new OpenAIVoice({
  speechModel: {
    name: 'tts-1-hd',
    apiKey: process.env.OPENAI_API_KEY,
  },
  speaker: 'alloy',
});

// デフォルト設定を使用する場合、設定を次のように簡略化できます:
const voice = new OpenAIVoice();
```

## 利用可能なプロバイダー \{#available-providers\}

Mastra は幅広い Text-to-Speech プロバイダーをサポートしており、それぞれ独自の機能や音声オプションを備えています。アプリケーションのニーズに最も適したプロバイダーをお選びください:

* [**OpenAI**](/docs/reference/voice/openai/) - 自然な抑揚と表現を備えた高品質な音声
* [**Azure**](/docs/reference/voice/azure/) - 多彩な音声と言語に対応する Microsoft の音声サービス
* [**ElevenLabs**](/docs/reference/voice/elevenlabs/) - 感情表現や細かな制御が可能な超リアルな音声
* [**PlayAI**](/docs/reference/voice/playai/) - 多様なスタイルの自然な音声に特化
* [**Google**](/docs/reference/voice/google/) - 多言語対応の Google の音声合成
* [**Cloudflare**](/docs/reference/voice/cloudflare/) - 低遅延アプリ向けのエッジ最適化音声合成
* [**Deepgram**](/docs/reference/voice/deepgram/) - 高精度な AI 駆動の音声技術
* [**Speechify**](/docs/reference/voice/speechify/) - 読み上げやアクセシビリティに最適化された Text-to-Speech
* [**Sarvam**](/docs/reference/voice/sarvam/) - インド系言語とアクセントに特化
* [**Murf**](/docs/reference/voice/murf/) - パラメーターを柔軟に調整できるスタジオ品質のボイスオーバー

各プロバイダーは個別のパッケージとして実装されており、必要に応じてインストールできます:

```bash
pnpm add @mastra/voice-openai  # OpenAIの例
```

## speak メソッドの使用 \{#using-the-speak-method\}

TTS の主なメソッドは `speak()` で、テキストを音声に変換します。このメソッドでは、話者の指定やその他のプロバイダー固有の設定などのオプションを渡すことができます。使い方は次のとおりです。

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { OpenAIVoice } from '@mastra/voice-openai';

const voice = new OpenAIVoice();

const agent = new Agent({
  name: 'Voice Agent',
  instructions: 'あなたはユーザーのタスクをサポートする音声アシスタントです。',
  model: openai('gpt-4o'),
  voice,
});

const { text } = await agent.generate('空は何色ですか?');

// テキストを音声に変換してオーディオストリームに出力
const readableStream = await voice.speak(text, {
  speaker: 'default', // オプション: 話者を指定
  properties: {
    speed: 1.0, // オプション: 読み上げ速度を調整
    pitch: 'default', // オプション: サポートされている場合、ピッチを指定
  },
});
```

エージェントでTTSを使用する方法は、[Adding Voice to Agents](../agents/adding-voice) のドキュメントをご覧ください。
