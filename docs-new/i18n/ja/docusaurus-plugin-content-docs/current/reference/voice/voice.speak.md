---
title: "リファレンス: voice.speak()"
description: "すべての Mastra の音声プロバイダーで利用できる speak() メソッドのドキュメント。テキストを音声に変換します。"
---

# voice.speak() \{#voicespeak\}

`speak()` メソッドは、すべての Mastra 音声プロバイダーで利用できる基本機能で、テキストを音声に変換します。テキストを入力として受け取り、再生や保存が可能な音声ストリームを返します。

## 使い方の例 \{#usage-example\}

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';
// 音声プロバイダーを初期化
const voice = new OpenAIVoice({
  speaker: 'alloy', // デフォルトの音声
});
// デフォルト設定での基本的な使用方法
const audioStream = await voice.speak('Hello, world!');
// この特定のリクエストで異なる音声を使用
const audioStreamWithDifferentVoice = await voice.speak('Hello again!', {
  speaker: 'nova',
});
// プロバイダー固有のオプションを使用
const audioStreamWithOptions = await voice.speak('Hello with options!', {
  speaker: 'echo',
  speed: 1.2, // OpenAI固有のオプション
});
// テキストストリームを入力として使用
import { Readable } from 'stream';
const textStream = Readable.from(['Hello', ' from', ' a', ' stream!']);
const audioStreamFromTextStream = await voice.speak(textStream);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description:
"音声に変換するテキスト。文字列またはテキストの読み取り可能なストリームを指定できます。",
isOptional: false,
},
{
name: "options",
type: "object",
description: "音声合成のオプション。",
isOptional: true,
},
{
name: "options.speaker",
type: "string",
description:
"このリクエストで使用する音声のID。コンストラクターで設定されたデフォルトの話者を上書きします。",
isOptional: true,
},
]}
/>

## 戻り値 \{#return-value\}

`Promise<NodeJS.ReadableStream | void>` を返します。内訳は次のとおりです:

* `NodeJS.ReadableStream`: 再生または保存できる音声データのストリーム
* `void`: 音声を直接返さず、イベント経由で音声を出力するリアルタイム音声プロバイダーを使用している場合

## プロバイダー固有のオプション \{#provider-specific-options\}

各音声プロバイダーは、実装に特有の追加オプションをサポートしている場合があります。以下にいくつかの例を示します。

### OpenAI \{#openai\}

<PropertiesTable
  content={[
{
name: "options.speed",
type: "number",
description:
"音声速度の倍率。0.25〜4.0 の値に対応しています。",
isOptional: true,
defaultValue: "1.0",
},
]}
/>

### ElevenLabs \{#elevenlabs\}

<PropertiesTable
  content={[
{
name: "options.stability",
type: "number",
description:
"音声の安定性。値が高いほど、より安定し、表現（抑揚）が少ない音声になります。",
isOptional: true,
defaultValue: "0.5",
},
{
name: "options.similarity_boost",
type: "number",
description: "音声の明瞭さと元の声への類似度。",
isOptional: true,
defaultValue: "0.75",
},
]}
/>

### Google \{#google\}

<PropertiesTable
  content={[
{
name: "options.languageCode",
type: "string",
description: "音声の言語コード（例: 'en-US'）。",
isOptional: true,
},
{
name: "options.audioConfig",
type: "object",
description:
"Google Cloud Text-to-Speech API の音声設定オプション。",
isOptional: true,
defaultValue: "{ audioEncoding: 'LINEAR16' }",
},
]}
/>

### Murf \{#murf\}

<PropertiesTable
  content={[
{
name: "options.properties.rate",
type: "number",
description: "読み上げ速度の倍率。",
isOptional: true,
},
{
name: "options.properties.pitch",
type: "number",
description: "声のピッチの調整。",
isOptional: true,
},
{
name: "options.properties.format",
type: "'MP3' | 'WAV' | 'FLAC' | 'ALAW' | 'ULAW'",
description: "出力音声の形式。",
isOptional: true,
},
]}
/>

## リアルタイム音声プロバイダー \{#realtime-voice-providers\}

`OpenAIRealtimeVoice` のようなリアルタイム音声プロバイダーを使用する場合、`speak()` メソッドの挙動は次のとおり異なります:

* 音声ストリームを返す代わりに、音声データを伴う &#39;speaking&#39; イベントを発行します
* 音声チャンクを受け取るには、イベントリスナーを登録する必要があります

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import Speaker from '@mastra/node-speaker';

const speaker = new Speaker({
  sampleRate: 24100, // オーディオのサンプルレート(Hz) - MacBook Proの高品質オーディオ標準
  channels: 1, // モノラル音声出力(ステレオの場合は2)
  bitDepth: 16, // オーディオ品質のビット深度 - CD品質標準(16ビット解像度)
});

const voice = new OpenAIRealtimeVoice();
await voice.connect();
// オーディオチャンクのイベントリスナーを登録
voice.on('speaker', stream => {
  // オーディオチャンクを処理(例: 再生または保存)
  stream.pipe(speaker);
});
// ストリームを返す代わりに'speaking'イベントを発行します
await voice.speak('こんにちは、これはリアルタイム音声です!');
```

## CompositeVoice の使用 \{#using-with-compositevoice\}

`CompositeVoice` を使用する場合、`speak()` メソッドは設定済みの発話プロバイダーに委譲されます。

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIVoice } from '@mastra/voice-openai';
import { PlayAIVoice } from '@mastra/voice-playai';
const voice = new CompositeVoice({
  speakProvider: new PlayAIVoice(),
  listenProvider: new OpenAIVoice(),
});
// PlayAIVoiceプロバイダーを使用します
const audioStream = await voice.speak('Hello, world!');
```

## 注意事項 \{#notes\}

* `speak()` の挙動はプロバイダーによってわずかに異なる場合がありますが、いずれの実装も同じ基本インターフェースに準拠します。
* リアルタイムの音声プロバイダーを使用する場合、このメソッドは音声ストリームを直接返さず、代わりに「speaking」イベントを発火することがあります。
* 入力としてテキストストリームが渡された場合、プロバイダーは通常、処理の前にそれを文字列へ変換します。
* 返されるストリームの音声フォーマットはプロバイダーによって異なります。一般的なフォーマットには MP3、WAV、OGG があります。
* パフォーマンス向上のため、使用が終わったら音声ストリームを閉じるか終了することを検討してください。