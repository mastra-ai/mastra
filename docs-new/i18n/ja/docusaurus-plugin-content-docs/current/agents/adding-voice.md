---
title: "音声を追加する"
sidebar_position: 6
---

# エージェントに音声機能を追加する \{#adding-voice-to-agents\}

Mastra のエージェントは音声対応で強化でき、応答を音声で出力したり、ユーザーの入力を音声で受け付けたりできます。エージェントは単一の音声プロバイダーを使用するように設定することも、用途に応じて複数のプロバイダーを組み合わせて運用することも可能です。

## 単一のプロバイダーを使う \{#using-a-single-provider\}

エージェントに音声機能を追加する最も簡単な方法は、発話と聞き取りの両方に同じプロバイダーを使うことです。

```typescript
import { createReadStream } from 'fs';
import path from 'path';
import { Agent } from '@mastra/core/agent';
import { OpenAIVoice } from '@mastra/voice-openai';
import { openai } from '@ai-sdk/openai';

// デフォルト設定で音声プロバイダーを初期化
const voice = new OpenAIVoice();

// 音声機能を持つエージェントを作成
export const agent = new Agent({
  name: 'Agent',
  instructions: `あなたはSTTとTTSの両方の機能を持つ親切なアシスタントです。`,
  model: openai('gpt-4o'),
  voice,
});

// エージェントは音声を使用してやり取りできるようになりました
const audioStream = await agent.voice.speak("こんにちは、私はあなたのAIアシスタントです!", {
  filetype: 'm4a',
});

playAudio(audioStream!);

try {
  const transcription = await agent.voice.listen(audioStream);
  console.log(transcription);
} catch (error) {
  console.error('音声の文字起こし中にエラーが発生しました:', error);
}
```

## 複数のプロバイダーを使用する \{#using-multiple-providers\}

柔軟性を高めるために、CompositeVoice クラスを使えば、発話と認識で異なるプロバイダーを利用できます。

```typescript
import { Agent } from '@mastra/core/agent';
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIVoice } from '@mastra/voice-openai';
import { PlayAIVoice } from '@mastra/voice-playai';
import { openai } from '@ai-sdk/openai';

export const agent = new Agent({
  name: 'Agent',
  instructions: `あなたはSTTとTTSの両方の機能を持つ便利なアシスタントです。`,
  model: openai('gpt-4o'),

  // 音声入力にOpenAI、音声出力にPlayAIを使用した複合音声を作成
  voice: new CompositeVoice({
    input: new OpenAIVoice(),
    output: new PlayAIVoice(),
  }),
});
```

## オーディオストリームの扱い \{#working-with-audio-streams\}

`speak()` と `listen()` メソッドは Node.js のストリームに対応しています。音声ファイルを保存・読み込む方法は次のとおりです：

### 音声出力の保存 \{#saving-speech-output\}

`speak` メソッドは、ファイルやスピーカーに出力をパイプできるストリームを返します。

```typescript
import { createWriteStream } from 'fs';
import path from 'path';

// 音声を生成してファイルに保存
const audio = await agent.voice.speak('こんにちは、世界!');
const filePath = path.join(process.cwd(), 'agent.mp3');
const writer = createWriteStream(filePath);

audio.pipe(writer);

await new Promise<void>((resolve, reject) => {
  writer.on('finish', () => resolve());
  writer.on('error', reject);
});
```

### 音声入力の文字起こし \{#transcribing-audio-input\}

`listen` メソッドは、マイクまたはファイルから供給される音声データのストリームを受け取ることを想定しています。

```typescript
import { createReadStream } from 'fs';
import path from 'path';

// 音声ファイルを読み込んで文字起こし
const audioFilePath = path.join(process.cwd(), '/agent.m4a');
const audioStream = createReadStream(audioFilePath);

try {
  console.log('音声ファイルを文字起こし中...');
  const transcription = await agent.voice.listen(audioStream, {
    filetype: 'm4a',
  });
  console.log('文字起こし結果:', transcription);
} catch (error) {
  console.error('音声の文字起こしエラー:', error);
}
```

## 音声同士の対話 \{#speech-to-speech-voice-interactions\}

よりダイナミックでインタラクティブな音声体験のために、音声対音声の機能に対応したリアルタイム音声プロバイダーを利用できます。

```typescript
import { Agent } from '@mastra/core/agent';
import { getMicrophoneStream } from '@mastra/node-audio';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { search, calculate } from '../tools';

// リアルタイム音声プロバイダーを初期化
const voice = new OpenAIRealtimeVoice({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini-realtime',
  speaker: 'alloy',
});

// 音声対話機能を持つエージェントを作成
export const agent = new Agent({
  name: 'Agent',
  instructions: `あなたは音声対話機能を持つ親切なアシスタントです。`,
  model: openai('gpt-4o'),
  tools: {
    // Agentに設定されたツールは音声プロバイダーに渡されます
    search,
    calculate,
  },
  voice,
});

// WebSocket接続を確立
await agent.voice.connect();

// 会話を開始
agent.voice.speak("こんにちは、私はあなたのAIアシスタントです!");

// マイクから音声をストリーミング
const microphoneStream = getMicrophoneStream();
agent.voice.send(microphoneStream);

// 会話が終了したら
agent.voice.close();
```

### イベントシステム \{#event-system\}

リアルタイム音声プロバイダーは、監視できるいくつかのイベントを発行します。

```typescript
// 音声プロバイダーから送信された音声データをリッスンする
agent.voice.on('speaking', ({ audio }) => {
  // audio には ReadableStream または Int16Array の音声データが含まれる
});

// 音声プロバイダーとユーザーの両方から送信された文字起こしテキストをリッスンする
agent.voice.on('writing', ({ text, role }) => {
  console.log(`${role} said: ${text}`);
});

// エラーをリッスンする
agent.voice.on('error', error => {
  console.error('Voice error:', error);
});
```

## サポート対象の音声プロバイダー \{#supported-voice-providers\}

Mastra はテキスト読み上げ（TTS）および音声認識（STT）に対応した複数の音声プロバイダーをサポートしています：

| Provider        | Package                         | Features                  | Reference                                              |
| --------------- | ------------------------------- | ------------------------- | ------------------------------------------------------ |
| OpenAI          | `@mastra/voice-openai`          | TTS, STT                  | [Documentation](/docs/reference/voice/openai)          |
| OpenAI Realtime | `@mastra/voice-openai-realtime` | リアルタイム音声対話       | [Documentation](/docs/reference/voice/openai-realtime) |
| ElevenLabs      | `@mastra/voice-elevenlabs`      | 高品質な TTS              | [Documentation](/docs/reference/voice/elevenlabs)      |
| PlayAI          | `@mastra/voice-playai`          | TTS                       | [Documentation](/docs/reference/voice/playai)          |
| Google          | `@mastra/voice-google`          | TTS, STT                  | [Documentation](/docs/reference/voice/google)          |
| Deepgram        | `@mastra/voice-deepgram`        | STT                       | [Documentation](/docs/reference/voice/deepgram)        |
| Murf            | `@mastra/voice-murf`            | TTS                       | [Documentation](/docs/reference/voice/murf)            |
| Speechify       | `@mastra/voice-speechify`       | TTS                       | [Documentation](/docs/reference/voice/speechify)       |
| Sarvam          | `@mastra/voice-sarvam`          | TTS, STT                  | [Documentation](/docs/reference/voice/sarvam)          |
| Azure           | `@mastra/voice-azure`           | TTS, STT                  | [Documentation](/docs/reference/voice/mastra-voice)    |
| Cloudflare      | `@mastra/voice-cloudflare`      | TTS                       | [Documentation](/docs/reference/voice/mastra-voice)    |

音声機能の詳細は、[Voice API リファレンス](/docs/reference/voice/mastra-voice)をご覧ください。