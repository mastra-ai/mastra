---
title: "リファレンス: voice.listen()"
description: "すべての Mastra の音声プロバイダーで利用可能な listen() メソッドのドキュメント。音声をテキストに変換します。"
---

# voice.listen() \{#voicelisten\}

`listen()` メソッドは、すべての Mastra 音声プロバイダーで利用できる基本機能で、音声をテキストに変換します。音声ストリームを入力として受け取り、文字起こししたテキストを返します。

## 使用例 \{#usage-example\}

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';
import { getMicrophoneStream } from '@mastra/node-audio';
import { createReadStream } from 'fs';
import path from 'path';

// 音声プロバイダーを初期化
const voice = new OpenAIVoice({
  listeningModel: {
    name: 'whisper-1',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// ファイルストリームを使った基本的な使用例
const audioFilePath = path.join(process.cwd(), 'audio.mp3');
const audioStream = createReadStream(audioFilePath);
const transcript = await voice.listen(audioStream, {
  filetype: 'mp3',
});
console.log('文字起こしされたテキスト:', transcript);

// マイクストリームを使用
const microphoneStream = getMicrophoneStream(); // この関数が音声入力を取得すると想定
const transcription = await voice.listen(microphoneStream);

// プロバイダー固有のオプションを使用
const transcriptWithOptions = await voice.listen(audioStream, {
  language: 'en',
  prompt: 'これは人工知能に関する会話です。',
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "audioStream",
type: "NodeJS.ReadableStream",
description:
"文字起こし対象の音声ストリーム。ファイルストリームまたはマイクストリームを指定できます。",
isOptional: false,
},
{
name: "options",
type: "object",
description: "音声認識プロバイダー固有のオプション",
isOptional: true,
},
]}
/>

## 返り値 \{#return-value\}

次のいずれかを返します：

* `Promise<string>`: 文字起こしされたテキストで解決される Promise
* `Promise<NodeJS.ReadableStream>`: 文字起こしテキストのストリームで解決される Promise（ストリーミング文字起こし用）
* `Promise<void>`: テキストを直接返さず、&#39;writing&#39; イベントを発行するリアルタイムプロバイダー向け

## プロバイダー固有のオプション \{#provider-specific-options\}

各音声プロバイダーは、実装に固有の追加オプションをサポートしている場合があります。以下はその一例です。

### OpenAI \{#openai\}

<PropertiesTable
  content={[
{
name: "options.filetype",
type: "string",
description: "音声ファイルの形式（例：'mp3'、'wav'、'm4a'）",
isOptional: true,
defaultValue: "'mp3'",
},
{
name: "options.prompt",
type: "string",
description: "モデルの文字起こしを補助するテキスト",
isOptional: true,
},
{
name: "options.language",
type: "string",
description: "言語コード（例：'en'、'fr'、'de'）",
isOptional: true,
},
]}
/>

### Google \{#google\}

<PropertiesTable
  content={[
{
name: "options.stream",
type: "boolean",
description: "ストリーミング認識を使用するかどうか",
isOptional: true,
defaultValue: "false",
},
{
name: "options.config",
type: "object",
description:
"Google Cloud Speech-to-Text API の認識設定",
isOptional: true,
defaultValue: "{ encoding: 'LINEAR16', languageCode: 'en-US' }",
},
]}
/>

### Deepgram \{#deepgram\}

<PropertiesTable
  content={[
{
name: "options.model",
type: "string",
description: "文字起こしに使用する Deepgram のモデル",
isOptional: true,
defaultValue: "'nova-2'",
},
{
name: "options.language",
type: "string",
description: "文字起こしの言語コード",
isOptional: true,
defaultValue: "'en'",
},
]}
/>

## リアルタイム音声プロバイダー \{#realtime-voice-providers\}

`OpenAIRealtimeVoice` のようなリアルタイム音声プロバイダーを使用する場合、`listen()` メソッドの挙動は次のように異なります。

* 文字起こし済みのテキストを返すのではなく、そのテキストを含む &#39;writing&#39; イベントを発行します
* 文字起こしを受け取るには、イベントリスナーを登録する必要があります

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { getMicrophoneStream } from '@mastra/node-audio';

const voice = new OpenAIRealtimeVoice();
await voice.connect();

// 文字起こしのイベントリスナーを登録
voice.on('writing', ({ text, role }) => {
  console.log(`${role}: ${text}`);
});

// テキストを返す代わりに 'writing' イベントを発行します
const microphoneStream = getMicrophoneStream();
await voice.listen(microphoneStream);
```

## CompositeVoice の使用 \{#using-with-compositevoice\}

`CompositeVoice` を使用する場合、`listen()` メソッドは設定されたリスニングプロバイダーに委譲されます。

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIVoice } from '@mastra/voice-openai';
import { PlayAIVoice } from '@mastra/voice-playai';

const voice = new CompositeVoice({
  listenProvider: new OpenAIVoice(),
  speakProvider: new PlayAIVoice(),
});

// OpenAIVoice プロバイダーが使用されます
const transcript = await voice.listen(audioStream);
```

## 注意事項 \{#notes\}

* すべての音声プロバイダーが音声認識（音声→テキスト）機能をサポートしているわけではありません（例：PlayAI、Speechify）
* `listen()` の動作はプロバイダーによって多少異なりますが、いずれの実装も同じ基本インターフェースに準拠しています
* リアルタイム音声プロバイダーを使用する場合、このメソッドはテキストを直接返さず、代わりに &quot;writing&quot; イベントを発行することがあります
* 対応する音声フォーマットはプロバイダーに依存します。一般的なフォーマットには MP3、WAV、M4A があります
* 一部のプロバイダーはストリーミング文字起こしに対応しており、書き起こしと同時にテキストが返されます
* パフォーマンスを最適化するため、使用が完了したら音声ストリームを閉じる（または終了する）ことを検討してください

## 関連メソッド \{#related-methods\}

* [voice.speak()](./voice.speak) - テキストを音声に変換します
* [voice.send()](./voice.send) - 音声データをリアルタイムで音声プロバイダに送信します
* [voice.on()](./voice.on) - 音声イベントのリスナーを登録します