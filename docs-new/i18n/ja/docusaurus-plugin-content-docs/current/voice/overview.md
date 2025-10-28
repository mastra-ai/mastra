---
title: 概要
description: Mastra の音声機能の概要。テキスト読み上げ、音声認識、リアルタイムの音声同士の変換・対話を含みます。
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { AudioPlayback } from '@site/src/components/AudioPlayback';

# Mastra の Voice \{#voice-in-mastra\}

Mastra の Voice システムは、音声インタラクションのための統一されたインターフェースを提供し、アプリケーションで text-to-speech (TTS)、speech-to-text (STT)、およびリアルタイムの speech-to-speech (STS) 機能を利用できるようにします。

## エージェントに音声を追加する \{#adding-voice-to-agents\}

エージェントに音声機能を組み込む方法については、[エージェントに音声を追加する](../agents/adding-voice)のドキュメントをご覧ください。本セクションでは、単一および複数の音声プロバイダーの使い方に加え、リアルタイムのやり取りについても解説します。

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { OpenAIVoice } from '@mastra/voice-openai';

// TTS用のOpenAI音声を初期化

const voiceAgent = new Agent({
  name: '音声エージェント',
  instructions: 'ユーザーのタスクをサポートする音声アシスタントです。',
  model: openai('gpt-4o'),
  voice: new OpenAIVoice(),
});
```

その後、次の音声機能を利用できます：

### Text to Speech (TTS) \{#text-to-speech-tts\}

Mastra の TTS 機能を使って、エージェントの応答を自然な音声に変換できます。
OpenAI や ElevenLabs など、複数のプロバイダーから選べます。

詳細な設定項目や高度な機能については、[Text-to-Speech ガイド](./text-to-speech)をご覧ください。

<Tabs>
  <TabItem value="タブ 1" label="タブ1">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { OpenAIVoice } from "@mastra/voice-openai";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new OpenAIVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに変換
    const audioStream = await voiceAgent.voice.speak(text, {
    speaker: "default", // オプション: スピーカーを指定
    responseFormat: "wav", // オプション: レスポンス形式を指定
    });

    playAudio(audioStream);

    ```

    OpenAI の音声プロバイダーの詳細については、[OpenAI Voice Reference](/docs/reference/voice/openai) をご覧ください。
  </TabItem>

  <TabItem value="タブ2" label="タブ2">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { AzureVoice } from "@mastra/voice-azure";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
      name: "Voice Agent",
      instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new AzureVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに変換
    const audioStream = await voiceAgent.voice.speak(text, {
      speaker: "en-US-JennyNeural", // オプション:スピーカーを指定
    });

    playAudio(audioStream);
    ```

    Azure 音声プロバイダーの詳細は、[Azure Voice Reference](/docs/reference/voice/azure) を参照してください。
  </TabItem>

  <TabItem value="タブ3" label="タブ3">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new ElevenLabsVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに出力
    const audioStream = await voiceAgent.voice.speak(text, {
    speaker: "default", // オプション: 話者を指定
    });

    playAudio(audioStream);

    ```

    ElevenLabs の音声プロバイダーについて詳しくは、[ElevenLabs Voice Reference](/docs/reference/voice/elevenlabs)をご覧ください。
  </TabItem>

  <TabItem value="タブ4" label="タブ4">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { PlayAIVoice } from "@mastra/voice-playai";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
      name: "音声エージェント",
      instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new PlayAIVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに変換
    const audioStream = await voiceAgent.voice.speak(text, {
      speaker: "default", // オプション: 話者を指定
    });

    playAudio(audioStream);
    ```

    PlayAI 音声プロバイダーの詳細は、[PlayAI Voice Reference](/docs/reference/voice/playai) をご覧ください。
  </TabItem>

  <TabItem value="タブ-5" label="タブ5">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { GoogleVoice } from "@mastra/voice-google";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new GoogleVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに出力
    const audioStream = await voiceAgent.voice.speak(text, {
    speaker: "en-US-Studio-O", // オプション: 話者を指定
    });

    playAudio(audioStream);

    ```

    Google の音声プロバイダーの詳細は、[Google Voice リファレンス](/docs/reference/voice/google)をご覧ください。
  </TabItem>

  <TabItem value="タブ-6" label="タブ6">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { CloudflareVoice } from "@mastra/voice-cloudflare";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
      name: "音声エージェント",
      instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new CloudflareVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに変換
    const audioStream = await voiceAgent.voice.speak(text, {
      speaker: "default", // オプション: 話者を指定
    });

    playAudio(audioStream);
    ```

    Cloudflare の音声プロバイダーについて詳しくは、[Cloudflare Voice リファレンス](/docs/reference/voice/cloudflare)をご覧ください。
  </TabItem>

  <TabItem value="タブ 7" label="タブ7">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { DeepgramVoice } from "@mastra/voice-deepgram";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new DeepgramVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに出力
    const audioStream = await voiceAgent.voice.speak(text, {
    speaker: "aura-english-us", // オプション:話者を指定
    });

    playAudio(audioStream);

    ```

    Deepgram の音声プロバイダーについて詳しくは、[Deepgram Voice Reference](/docs/reference/voice/deepgram)をご覧ください。
  </TabItem>

  <TabItem value="タブ-8" label="タブ8">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { SpeechifyVoice } from "@mastra/voice-speechify";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
      name: "音声エージェント",
      instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new SpeechifyVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに出力
    const audioStream = await voiceAgent.voice.speak(text, {
      speaker: "matthew", // オプション: 話者を指定
    });

    playAudio(audioStream);
    ```

    Speechify の音声プロバイダーについて詳しくは、[Speechify Voice Reference](/docs/reference/voice/speechify) をご覧ください。
  </TabItem>

  <TabItem value="Tab-9" label="タブ9">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { SarvamVoice } from "@mastra/voice-sarvam";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new SarvamVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに変換
    const audioStream = await voiceAgent.voice.speak(text, {
    speaker: "default", // オプション: スピーカーを指定
    });

    playAudio(audioStream);

    ```

    Sarvam 音声プロバイダーの詳細は、[Sarvam Voice Reference](/docs/reference/voice/sarvam)をご覧ください。
  </TabItem>

  <TabItem value="タブ-10" label="タブ10">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { MurfVoice } from "@mastra/voice-murf";
    import { playAudio } from "@mastra/node-audio";

    const voiceAgent = new Agent({
      name: "Voice Agent",
      instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new MurfVoice(),
    });

    const { text } = await voiceAgent.generate('空は何色ですか?');

    // テキストを音声に変換してオーディオストリームに出力
    const audioStream = await voiceAgent.voice.speak(text, {
      speaker: "default", // オプション: スピーカーを指定
    });

    playAudio(audioStream);
    ```

    Murf の音声プロバイダーについて詳しくは、[Murf Voice Reference](/docs/reference/voice/murf)をご覧ください。
  </TabItem>
</Tabs>

### 音声認識（STT） \{#speech-to-text-stt\}

OpenAI、ElevenLabs などの各種プロバイダーを利用して、音声コンテンツを文字起こしできます。詳細な設定オプションなどについては、[音声認識](./speech-to-text)を参照してください。

サンプル音声ファイルは[こちら](https://github.com/mastra-ai/realtime-voice-demo/raw/refs/heads/main/how_can_i_help_you.mp3)からダウンロードできます。

<br />

<AudioPlayback audio="https://github.com/mastra-ai/realtime-voice-demo/raw/refs/heads/main/how_can_i_help_you.mp3" />

<Tabs>
  <TabItem value="openai-stt" label="OpenAI">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { OpenAIVoice } from "@mastra/voice-openai";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new OpenAIVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // トランスクリプトに基づいて応答を生成
    const { text } = await voiceAgent.generate(transcript);

    ```

    OpenAI の音声プロバイダーに関する詳細は、[OpenAI Voice Reference](/docs/reference/voice/openai) をご覧ください。
  </TabItem>

  <TabItem value="azure-stt" label="Azure">
    ```typescript
    import { createReadStream } from 'fs';
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { AzureVoice } from "@mastra/voice-azure";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
      name: "音声エージェント",
      instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new AzureVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // トランスクリプトに基づいてレスポンスを生成
    const { text } = await voiceAgent.generate(transcript);
    ```

    Azure 音声プロバイダーの詳細は、[Azure Voice Reference](/docs/reference/voice/azure) をご覧ください。
  </TabItem>

  <TabItem value="ElevenLabs STT" label="ElevenLabs">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
    name: "Voice Agent",
    instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new ElevenLabsVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // 文字起こし結果に基づいて応答を生成
    const { text } = await voiceAgent.generate(transcript);

    ```

    ElevenLabs の音声プロバイダーの詳細については、[ElevenLabs Voice Reference](/docs/reference/voice/elevenlabs) をご覧ください。
  </TabItem>

  <TabItem value="Google 音声認識（STT）" label="Google">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { GoogleVoice } from "@mastra/voice-google";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
      name: "Voice Agent",
      instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new GoogleVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // 文字起こし結果に基づいて応答を生成
    const { text } = await voiceAgent.generate(transcript);
    ```

    Google の音声プロバイダーの詳細は、[Google Voice リファレンス](/docs/reference/voice/google)をご覧ください。
  </TabItem>

  <TabItem value="cloudflare-stt" label="Cloudflare">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { CloudflareVoice } from "@mastra/voice-cloudflare";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new CloudflareVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // トランスクリプトに基づいてレスポンスを生成
    const { text } = await voiceAgent.generate(transcript);

    ```

    Cloudflare の音声プロバイダーについて詳しくは、[Cloudflare Voice Reference](/docs/reference/voice/cloudflare)をご覧ください。
  </TabItem>

  <TabItem value="Deepgram STT" label="Deepgram">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { DeepgramVoice } from "@mastra/voice-deepgram";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
      name: "音声エージェント",
      instructions: "ユーザーのタスクをサポートする音声アシスタントです。",
      model: openai("gpt-4o"),
      voice: new DeepgramVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // トランスクリプトに基づいて応答を生成
    const { text } = await voiceAgent.generate(transcript);
    ```

    Deepgram の音声プロバイダーの詳細については、[Deepgram Voice Reference](/docs/reference/voice/deepgram) をご覧ください。
  </TabItem>

  <TabItem value="sarvam-stt" label="サルヴァム">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { SarvamVoice } from "@mastra/voice-sarvam";
    import { createReadStream } from 'fs';

    const voiceAgent = new Agent({
    name: "音声エージェント",
    instructions: "あなたはユーザーのタスクをサポートする音声アシスタントです。",
    model: openai("gpt-4o"),
    voice: new SarvamVoice(),
    });

    // URLから音声ファイルを使用
    const audioStream = await createReadStream("./how_can_i_help_you.mp3");

    // 音声をテキストに変換
    const transcript = await voiceAgent.voice.listen(audioStream);
    console.log(`ユーザーの発言: ${transcript}`);

    // 文字起こし結果に基づいて応答を生成
    const { text } = await voiceAgent.generate(transcript);

    ```

    Sarvam の音声プロバイダーについて詳しくは、[Sarvam Voice Reference](/docs/reference/voice/sarvam)をご覧ください。
  </TabItem>
</Tabs>

### 音声対話（STS） \{#speech-to-speech-sts\}

音声対話機能で会話型の体験を構築できます。統合APIにより、ユーザーとAIエージェントの間でリアルタイムの音声インタラクションが可能です。
詳細な設定オプションや高度な機能については、[Speech to Speech](./speech-to-speech)をご覧ください。

<Tabs>
  <TabItem value="tab-1" label="Tab 1">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { playAudio, getMicrophoneStream } from '@mastra/node-audio';
    import { OpenAIRealtimeVoice } from "@mastra/voice-openai-realtime";

    const voiceAgent = new Agent({
      name: "Voice Agent",
      instructions: "You are a voice assistant that can help users with their tasks.",
      model: openai("gpt-4o"),
      voice: new OpenAIRealtimeVoice(),
    });

    // エージェントの音声レスポンスを再生
    voiceAgent.voice.on('speaker', ({ audio }) => {
      playAudio(audio);
    });

    // 会話を開始
    await voiceAgent.voice.speak('How can I help you today?');

    // マイクから連続的に音声を送信
    const micStream = getMicrophoneStream();
    await voiceAgent.voice.send(micStream);
    ```

    OpenAIの音声プロバイダーの詳細は、[OpenAI Voice Reference](/docs/reference/voice/openai-realtime)をご覧ください。
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    ```typescript
    import { Agent } from '@mastra/core/agent';
    import { openai } from '@ai-sdk/openai';
    import { playAudio, getMicrophoneStream } from '@mastra/node-audio';
    import { GeminiLiveVoice } from "@mastra/voice-google-gemini-live";

    const voiceAgent = new Agent({
    name: "Voice Agent",
    instructions: "You are a voice assistant that can help users with their tasks.",
    model: openai("gpt-4o"),
    voice: new GeminiLiveVoice({
    // Live API mode
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-2.0-flash-exp',
    speaker: 'Puck',
    debug: true,
    // Vertex AI alternative:
    // vertexAI: true,
    // project: 'your-gcp-project',
    // location: 'us-central1',
    // serviceAccountKeyFile: '/path/to/service-account.json',
    }),
    });

    // speak/send を使う前に接続
    await voiceAgent.voice.connect();

    // エージェントの音声レスポンスを再生
    voiceAgent.voice.on('speaker', ({ audio }) => {
    playAudio(audio);
    });

    // テキスト応答や文字起こしを表示
    voiceAgent.voice.on('writing', ({ text, role }) => {
    console.log(`${role}: ${text}`);
    });

    // 会話を開始
    await voiceAgent.voice.speak('How can I help you today?');

    // マイクから連続的に音声を送信
    const micStream = getMicrophoneStream();
    await voiceAgent.voice.send(micStream);

    ```

    Google Gemini Live の音声プロバイダーの詳細は、[Google Gemini Live Reference](/docs/reference/voice/google-gemini-live)をご覧ください。
  </TabItem>
</Tabs>

## 音声の設定 \{#voice-configuration\}

各音声プロバイダーは、さまざまなモデルやオプションで構成できます。以下に、サポートされている各プロバイダーの詳細な設定オプションを示します。

<Tabs>
  <TabItem value="タブ1" label="タブ1">
    ```typescript
    // OpenAI音声設定
    const voice = new OpenAIVoice({
      speechModel: {
        name: "gpt-3.5-turbo", // モデル名の例
        apiKey: process.env.OPENAI_API_KEY,
        language: "en-US", // 言語コード
        voiceType: "neural", // 音声モデルのタイプ
      },
      listeningModel: {
        name: "whisper-1", // モデル名の例
        apiKey: process.env.OPENAI_API_KEY,
        language: "en-US", // 言語コード
        format: "wav", // 音声フォーマット
      },
      speaker: "alloy", // スピーカー名の例
    });
    ```

    OpenAI の音声プロバイダーの詳細は、[OpenAI Voice Reference](/docs/reference/voice/openai)をご覧ください。
  </TabItem>

  <TabItem value="タブ 2" label="タブ2">
    ```typescript
    // Azure音声設定
    const voice = new AzureVoice({
      speechModel: {
        name: "en-US-JennyNeural", // モデル名の例
        apiKey: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION,
        language: "en-US", // 言語コード
        style: "cheerful", // 音声スタイル
        pitch: "+0Hz", // ピッチ調整
        rate: "1.0", // 発話速度
      },
      listeningModel: {
        name: "en-US", // モデル名の例
        apiKey: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION,
        format: "simple", // 出力形式
      },
    });
    ```

    Azure の音声プロバイダーについて詳しくは、[Azure Voice Reference](/docs/reference/voice/azure) をご覧ください。
  </TabItem>

  <TabItem value="タブ-3" label="タブ3">
    ```typescript
    // ElevenLabs 音声設定
    const voice = new ElevenLabsVoice({
      speechModel: {
        voiceId: "your-voice-id", // 音声IDの例
        model: "eleven_multilingual_v2", // モデル名の例
        apiKey: process.env.ELEVENLABS_API_KEY,
        language: "en", // 言語コード
        emotion: "neutral", // 感情設定
      },
      // ElevenLabsには別個のリスニングモデルがない場合があります
    });
    ```

    ElevenLabs の音声プロバイダーについて詳しくは、[ElevenLabs Voice Reference](/docs/reference/voice/elevenlabs) をご覧ください。
  </TabItem>

  <TabItem value="タブ4" label="タブ4">
    ```typescript
    // PlayAI音声設定
    const voice = new PlayAIVoice({
      speechModel: {
        name: "playai-voice", // モデル名の例
        speaker: "emma", // 話者名の例
        apiKey: process.env.PLAYAI_API_KEY,
        language: "en-US", // 言語コード
        speed: 1.0, // 音声速度
      },
      // PlayAIには別個のリスニングモデルがない可能性があります
    });
    ```

    PlayAI の音声プロバイダーの詳細は、[PlayAI Voice Reference](/docs/reference/voice/playai) をご参照ください。
  </TabItem>

  <TabItem value="タブ5" label="タブ5">
    ```typescript
    // Google Voice 設定
    const voice = new GoogleVoice({
      speechModel: {
        name: "en-US-Studio-O", // モデル名の例
        apiKey: process.env.GOOGLE_API_KEY,
        languageCode: "en-US", // 言語コード
        gender: "FEMALE", // 音声の性別
        speakingRate: 1.0, // 発話速度
      },
      listeningModel: {
        name: "en-US", // モデル名の例
        sampleRateHertz: 16000, // サンプリングレート
      },
    });
    ```

    Google の音声プロバイダーについて詳しくは、[Google Voice リファレンス](/docs/reference/voice/google)をご覧ください。
  </TabItem>

  <TabItem value="タブ6" label="タブ6">
    ```typescript
    // Cloudflare音声設定
    const voice = new CloudflareVoice({
      speechModel: {
        name: "cloudflare-voice", // モデル名の例
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
        language: "en-US", // 言語コード
        format: "mp3", // 音声フォーマット
      },
      // Cloudflareには個別のリスニングモデルがない可能性があります
    });
    ```

    Cloudflare の音声プロバイダーについて詳しくは、[Cloudflare Voice リファレンス](/docs/reference/voice/cloudflare)をご覧ください。
  </TabItem>

  <TabItem value="タブ-7" label="タブ7">
    ```typescript
    // Deepgram音声設定
    const voice = new DeepgramVoice({
      speechModel: {
        name: "nova-2", // モデル名の例
        speaker: "aura-english-us", // 話者名の例
        apiKey: process.env.DEEPGRAM_API_KEY,
        language: "en-US", // 言語コード
        tone: "formal", // トーン設定
      },
      listeningModel: {
        name: "nova-2", // モデル名の例
        format: "flac", // オーディオ形式
      },
    });
    ```

    Deepgram の音声プロバイダーについて詳しくは、[Deepgram Voice Reference](/docs/reference/voice/deepgram)をご覧ください。
  </TabItem>

  <TabItem value="タブ8" label="タブ8">
    ```typescript
    // Speechify 音声設定
    const voice = new SpeechifyVoice({
      speechModel: {
        name: "speechify-voice", // モデル名の例
        speaker: "matthew", // 話者名の例
        apiKey: process.env.SPEECHIFY_API_KEY,
        language: "en-US", // 言語コード
        speed: 1.0, // 読み上げ速度
      },
      // Speechify には別個のリスニングモデルがない場合があります
    });
    ```

    Speechify の音声プロバイダーの詳細は、[Speechify Voice Reference](/docs/reference/voice/speechify) をご覧ください。
  </TabItem>

  <TabItem value="タブ-9" label="タブ9">
    ```typescript
    // Sarvam音声設定
    const voice = new SarvamVoice({
      speechModel: {
        name: "sarvam-voice", // モデル名の例
        apiKey: process.env.SARVAM_API_KEY,
        language: "en-IN", // 言語コード
        style: "conversational", // スタイル設定
      },
      // Sarvamには個別のリスニングモデルがない場合があります
    });
    ```

    Sarvam の音声プロバイダーについて詳しくは、[Sarvam Voice Reference](/docs/reference/voice/sarvam)をご覧ください。
  </TabItem>

  <TabItem value="タブ-10" label="タブ10">
    ```typescript
    // Murf音声設定
    const voice = new MurfVoice({
      speechModel: {
        name: "murf-voice", // モデル名の例
        apiKey: process.env.MURF_API_KEY,
        language: "en-US", // 言語コード
        emotion: "happy", // 感情設定
      },
      // Murfには個別のリスニングモデルがない場合があります
    });
    ```

    Murf の音声プロバイダーの詳細は、[Murf Voice Reference](/docs/reference/voice/murf)をご参照ください。
  </TabItem>

  <TabItem value="タブ11" label="タブ11">
    ```typescript
    // OpenAI リアルタイム音声設定
    const voice = new OpenAIRealtimeVoice({
      speechModel: {
        name: "gpt-3.5-turbo", // モデル名の例
        apiKey: process.env.OPENAI_API_KEY,
        language: "en-US", // 言語コード
      },
      listeningModel: {
        name: "whisper-1", // モデル名の例
        apiKey: process.env.OPENAI_API_KEY,
        format: "ogg", // 音声フォーマット
      },
      speaker: "alloy", // スピーカー名の例
    });
    ```

    OpenAI Realtime の音声プロバイダーについて詳しくは、[OpenAI Realtime Voice Reference](/docs/reference/voice/openai-realtime)をご覧ください。
  </TabItem>

  <TabItem value="タブ-12" label="タブ12">
    ```typescript
    // Google Gemini Live 音声設定
    const voice = new GeminiLiveVoice({
      speechModel: {
        name: "gemini-2.0-flash-exp", // モデル名の例
        apiKey: process.env.GOOGLE_API_KEY,
      },
      speaker: "Puck", // スピーカー名の例
      // Google Gemini Live は音声認識と音声合成のモデルが統合されたリアルタイム双方向APIです
    });
    ```

    Google Gemini Live の音声プロバイダーについて詳しくは、[Google Gemini Live リファレンス](/docs/reference/voice/google-gemini-live)をご覧ください。
  </TabItem>
</Tabs>

### 複数の音声プロバイダーを使う \{#using-multiple-voice-providers\}

この例では、Mastra で OpenAI を音声認識（STT）、PlayAI を音声合成（TTS）として、2 つの異なる音声プロバイダーを作成して利用する方法を示します。

まず、必要な設定を行い、各音声プロバイダーのインスタンスを作成します。

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';
import { PlayAIVoice } from '@mastra/voice-playai';
import { CompositeVoice } from '@mastra/core/voice';
import { playAudio, getMicrophoneStream } from '@mastra/node-audio';

// STT用のOpenAI音声を初期化
const input = new OpenAIVoice({
  listeningModel: {
    name: 'whisper-1',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// TTS用のPlayAI音声を初期化
const output = new PlayAIVoice({
  speechModel: {
    name: 'playai-voice',
    apiKey: process.env.PLAYAI_API_KEY,
  },
});

// CompositeVoiceを使用してプロバイダーを結合
const voice = new CompositeVoice({
  input,
  output,
});

// 結合された音声プロバイダーを使用して音声対話を実装
const audioStream = getMicrophoneStream(); // この関数が音声入力を取得すると想定
const transcript = await voice.listen(audioStream);

// 文字起こしされたテキストをログ出力
console.log('文字起こしされたテキスト:', transcript);

// テキストを音声に変換
const responseAudio = await voice.speak(`You said: ${transcript}`, {
  speaker: 'default', // オプション: スピーカーを指定
  responseFormat: 'wav', // オプション: レスポンス形式を指定
});

// 音声レスポンスを再生
playAudio(responseAudio);
```

CompositeVoice の詳細については、[CompositeVoice リファレンス](/docs/reference/voice/composite-voice)をご覧ください。

## さらに詳しい資料 \{#more-resources\}

* [CompositeVoice](/docs/reference/voice/composite-voice)
* [MastraVoice](/docs/reference/voice/mastra-voice)
* [OpenAI Voice](/docs/reference/voice/openai)
* [OpenAI Realtime Voice](/docs/reference/voice/openai-realtime)
* [Azure Voice](/docs/reference/voice/azure)
* [Google Voice](/docs/reference/voice/google)
* [Google Gemini Live Voice](/docs/reference/voice/google-gemini-live)
* [Deepgram Voice](/docs/reference/voice/deepgram)
* [PlayAI Voice](/docs/reference/voice/playai)
* [音声のサンプル](/docs/examples/voice/text-to-speech)