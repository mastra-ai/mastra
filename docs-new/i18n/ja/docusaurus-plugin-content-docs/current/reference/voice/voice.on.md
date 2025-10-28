---
title: "リファレンス: voice.on()"
description: "音声プロバイダーで利用可能な on() メソッドのドキュメント。音声イベントのリスナーを登録します。"
---

# voice.on() \{#voiceon\}

`on()` メソッドは、さまざまな音声イベントに対するイベントリスナーを登録します。特にリアルタイムの音声プロバイダーにおいて重要で、書き起こしテキストや音声レスポンス、その他の状態変化などをイベントを通じてやり取りします。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import Speaker from '@mastra/node-speaker';
import chalk from 'chalk';

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  realtimeConfig: {
    model: 'gpt-4o-mini-realtime',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// リアルタイムサービスに接続
await voice.connect();

// 文字起こしテキストのイベントリスナーを登録
voice.on('writing', event => {
  if (event.role === 'user') {
    process.stdout.write(chalk.green(event.text));
  } else {
    process.stdout.write(chalk.blue(event.text));
  }
});

// 音声データをリッスンして再生
const speaker = new Speaker({
  sampleRate: 24100,
  channels: 1,
  bitDepth: 16,
});

voice.on('speaker', stream => {
  stream.pipe(speaker);
});

// エラーのイベントリスナーを登録
voice.on('error', ({ message, code, details }) => {
  console.error(`Error ${code}: ${message}`, details);
});
```

## パラメーター \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "event",
    type: "string",
    description:
      "監視するイベント名。利用可能なイベントの一覧は [Voice Events](./voice.events) のドキュメントを参照してください。",
    isOptional: false,
  },
  {
    name: "callback",
    type: "function",
    description:
      "イベント発生時に呼び出されるコールバック関数。コールバックのシグネチャはイベントごとに異なります。",
    isOptional: false,
  },
]}
/>

## 戻り値 \{#return-value\}

このメソッドは値を返しません。

## イベント \{#events\}

イベントとそのペイロード構造の網羅的な一覧については、[Voice Events](./voice.events) ドキュメントを参照してください。

主なイベントは次のとおりです:

* `speaking`: 音声データが利用可能になったときに発生
* `speaker`: オーディオ出力へパイプ可能なストリームとともに発生
* `writing`: テキストが書き起こしまたは生成されたときに発生
* `error`: エラーが発生したときに発生
* `tool-call-start`: ツールの実行直前に発生
* `tool-call-result`: ツールの実行完了時に発生

音声プロバイダーによって、サポートされるイベントの種類やペイロード構造は異なる場合があります。

## CompositeVoice と併用する \{#using-with-compositevoice\}

`CompositeVoice` を使用する場合、`on()` メソッドは設定済みのリアルタイムプロバイダーに委譲されます:

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import Speaker from '@mastra/node-speaker';

const speaker = new Speaker({
  sampleRate: 24100, // オーディオサンプルレート(Hz) - MacBook Proの高品質オーディオ標準
  channels: 1, // モノラル音声出力(ステレオは2)
  bitDepth: 16, // オーディオ品質のビット深度 - CD品質標準(16ビット解像度)
});

const realtimeVoice = new OpenAIRealtimeVoice();
const voice = new CompositeVoice({
  realtimeProvider: realtimeVoice,
});

// リアルタイムサービスに接続
await voice.connect();

// OpenAIRealtimeVoiceプロバイダーにイベントリスナーを登録
voice.on('speaker', stream => {
  stream.pipe(speaker);
});
```

## 注意事項 \{#notes\}

* このメソッドは、イベントベース通信をサポートするリアルタイム音声プロバイダで主に使用します
* イベントをサポートしない音声プロバイダで呼び出された場合は、警告をログ出力し、何も行いません
* イベントを発行する可能性があるメソッドを呼び出す前に、イベントリスナーを登録してください
* イベントリスナーを削除するには、同じイベント名とコールバック関数を指定して [voice.off()](./voice.off) メソッドを使用します
* 同一イベントに対して複数のリスナーを登録できます
* コールバック関数が受け取るデータはイベントタイプによって異なります（[Voice Events](./voice.events) を参照）
* パフォーマンスを最適化するため、不要になったイベントリスナーは削除することを検討してください