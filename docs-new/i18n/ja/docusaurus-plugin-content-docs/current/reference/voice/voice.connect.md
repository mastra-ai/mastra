---
title: "リファレンス: voice.connect()"
description: "リアルタイム音声プロバイダーで利用可能な connect() メソッドのドキュメント。音声対話（スピーチ・ツー・スピーチ）通信の接続を確立します。"
---

# voice.connect() \{#voiceconnect\}

`connect()` メソッドは、リアルタイムの音声同士の通信を行うために、WebSocket または WebRTC の接続を確立します。このメソッドは、`send()` や `answer()` などの他のリアルタイム機能を使用する前に呼び出す必要があります。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import Speaker from '@mastra/node-speaker';

const speaker = new Speaker({
  sampleRate: 24100, // オーディオのサンプルレート(Hz) - MacBook Proの高品質オーディオ標準
  channels: 1, // モノラル音声出力(ステレオの場合は2)
  bitDepth: 16, // オーディオ品質のビット深度 - CD品質標準(16ビット解像度)
});

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
    options: {
      sessionConfig: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,
          silence_duration_ms: 1200,
        },
      },
    },
  },
  speaker: 'alloy', // デフォルトの音声
});
// リアルタイムサービスに接続
await voice.connect();
// リアルタイム機能を使用可能
voice.on('speaker', stream => {
  stream.pipe(speaker);
});
// 接続オプション付き
await voice.connect({
  timeout: 10000, // 10秒のタイムアウト
  reconnect: true,
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "Record<string, unknown>",
description: "プロバイダ固有の接続オプション",
isOptional: true,
},
]}
/>

## 戻り値 \{#return-value\}

接続の確立に成功すると解決される `Promise<void>` を返します。

## プロバイダー固有のオプション \{#provider-specific-options\}

各リアルタイム音声プロバイダーは、`connect()` メソッドでサポートするオプションが異なる場合があります。

### OpenAI Realtime \{#openai-realtime\}

<PropertiesTable
  content={[
{
name: "options.timeout",
type: "number",
description: "接続のタイムアウト（ミリ秒）",
isOptional: true,
defaultValue: "30000",
},
{
name: "options.reconnect",
type: "boolean",
description: "接続断時に自動で再接続するかどうか",
isOptional: true,
defaultValue: "false",
},
]}
/>

## CompositeVoice の使用 \{#using-with-compositevoice\}

`CompositeVoice` を使用する場合、`connect()` メソッドは設定されたリアルタイムプロバイダに委譲されます。

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
const realtimeVoice = new OpenAIRealtimeVoice();
const voice = new CompositeVoice({
  realtimeProvider: realtimeVoice,
});
// OpenAIRealtimeVoiceプロバイダーを使用します
await voice.connect();
```

## 注意事項 \{#notes\}

* このメソッドは、音声同士の変換（speech-to-speech）に対応するリアルタイム音声プロバイダーにのみ実装されています
* この機能に非対応の音声プロバイダーで呼び出した場合は、警告をログ出力し、即座に処理を完了します
* `send()` や `answer()` などの他のリアルタイムメソッドを使用する前に、接続を確立する必要があります
* 音声インスタンスの利用が終わったら、`close()` を呼び出してリソースを適切にクリーンアップしてください
* 実装によっては、接続喪失時に自動再接続するプロバイダーもあります
* 接続エラーは通常、捕捉して処理すべき例外としてスローされます

## 関連メソッド \{#related-methods\}

* [voice.send()](./voice.send) - 音声プロバイダーに音声データを送信する
* [voice.answer()](./voice.answer) - 音声プロバイダーに応答を指示する
* [voice.close()](./voice.close) - リアルタイムサービスから切断する
* [voice.on()](./voice.on) - 音声イベント用のイベントリスナーを登録する