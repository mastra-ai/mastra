---
title: "リファレンス: voice.send()"
description: "リアルタイム音声プロバイダーで利用可能な send() メソッドのドキュメント。継続的な処理のために音声データをストリーミングします。"
---

# voice.send() \{#voicesend\}

`send()` メソッドは、音声プロバイダーに対して音声データをリアルタイムでストリーミングし、継続的に処理させます。マイク入力を直接 AI サービスに送信できるため、リアルタイムの音声対話（音声から音声への会話）に不可欠なメソッドです。

## 使用例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import Speaker from '@mastra/node-speaker';
import { getMicrophoneStream } from '@mastra/node-audio';

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
  },
});

// リアルタイムサービスに接続
await voice.connect();

// レスポンス用のイベントリスナーを設定
voice.on('writing', ({ text, role }) => {
  console.log(`${role}: ${text}`);
});

voice.on('speaker', stream => {
  stream.pipe(speaker);
});

// マイクストリームを取得(実装は環境に依存)
const microphoneStream = getMicrophoneStream();

// 音声データを音声プロバイダーに送信
await voice.send(microphoneStream);

// Int16Arrayとして音声データを送信することも可能
const audioBuffer = getAudioBuffer(); // Int16Arrayを返すと仮定
await voice.send(audioBuffer);
```

## パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "audioData",
    type: "NodeJS.ReadableStream | Int16Array",
    description:
      "音声プロバイダーに送信する音声データ。読み取り可能なストリーム（マイク入力など）または音声サンプルの Int16Array を指定できます。",
    isOptional: false,
  },
]}
/>

## 返り値 \{#return-value\}

音声プロバイダーが音声データの受け入れを完了すると解決される `Promise<void>` を返します。

## 注意事項 \{#notes\}

* このメソッドは、音声から音声への変換機能をサポートするリアルタイム音声プロバイダーでのみ実装されています
* この機能をサポートしない音声プロバイダーで呼び出した場合は、警告をログに出力して即座に完了します
* WebSocket 接続を確立するために、`send()` を使用する前に必ず `connect()` を呼び出してください
* 音声フォーマットの要件は、利用する音声プロバイダーによって異なります
* 連続的な対話では、通常はユーザーの音声を送信するために `send()` を呼び出し、その後 AI の応答をトリガーするために `answer()` を呼び出します
* プロバイダーは通常、音声を処理しながら、書き起こしテキストを含む &#39;writing&#39; イベントを発行します
* AI が応答する際、プロバイダーは音声応答を含む &#39;speaking&#39; イベントを発行します