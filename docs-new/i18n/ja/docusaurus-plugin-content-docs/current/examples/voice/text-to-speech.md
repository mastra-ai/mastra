---
title: "音声合成"
description: Mastra を使って音声合成アプリケーションを作成する例。
---

# インタラクティブストーリー生成ツール \{#interactive-story-generator\}

以下のコードスニペットは、Next.js を使用し、Mastra を別バックエンドとして統合したインタラクティブなストーリー生成アプリにおける Text-to-Speech（TTS）機能の実装例です。この例では、Mastra の client-js SDK を使って Mastra のバックエンドに接続する方法を示します。Next.js との連携方法の詳細は、[Next.js との連携](/docs/frameworks/web-frameworks/next-js) をご参照ください。

## TTS 機能を備えたエージェントの作成 \{#creating-an-agent-with-tts-capabilities\}

次の例では、バックエンドで TTS 機能を持つストーリー生成エージェントを設定する方法を示します。

```typescript filename="src/mastra/agents/index.ts"
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { OpenAIVoice } from '@mastra/voice-openai';
import { Memory } from '@mastra/memory';

const instructions = `
    あなたはインタラクティブストーリーテラーエージェントです。あなたの役割は、ユーザーの選択によって物語が変化する魅力的な
    短編ストーリーを作成することです。// 簡潔さのため省略
`;

export const storyTellerAgent = new Agent({
  name: 'ストーリーテラーエージェント',
  instructions: instructions,
  model: openai('gpt-4o'),
  voice: new OpenAIVoice(),
});
```

## Mastra へのエージェントの登録 \{#registering-the-agent-with-mastra\}

このスニペットでは、Mastra インスタンスにエージェントを登録する方法を示します。

```typescript filename="src/mastra/index.ts"
import { PinoLogger } from '@mastra/loggers';
import { Mastra } from '@mastra/core/mastra';
import { storyTellerAgent } from './agents';

export const mastra = new Mastra({
  agents: { storyTellerAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## フロントエンドから Mastra に接続する \{#connecting-to-mastra-from-the-frontend\}

ここでは Mastra Client SDK を用いて、Mastra サーバーと連携します。Mastra Client SDK の詳細は、[ドキュメント](/docs/server-db/mastra-client)をご覧ください。

```typescript filename="src/app/page.tsx"
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: 'http://localhost:4111', // Mastra バックエンドの URL に置き換えます
});
```

## ストーリーコンテンツの生成と音声への変換 \{#generating-story-content-and-converting-to-speech\}

この例では、Mastra エージェントへの参照を取得し、ユーザー入力に基づいてストーリーコンテンツを生成し、そのコンテンツを音声に変換する方法を示します。

```typescript filename="/app/components/StoryManager.tsx"
const handleInitialSubmit = async (formData: FormData) => {
  setIsLoading(true);
  try {
    const agent = mastraClient.getAgent('storyTellerAgent');
    const message = `現在のフェーズ: BEGINNING. ストーリージャンル: ${formData.genre}, 主人公の名前: ${formData.protagonistDetails.name}, 主人公の年齢: ${formData.protagonistDetails.age}, 主人公の性別: ${formData.protagonistDetails.gender}, 主人公の職業: ${formData.protagonistDetails.occupation}, ストーリーの設定: ${formData.setting}`;
    const storyResponse = await agent.generate({
      messages: [{ role: 'user', content: message }],
      threadId: storyState.threadId,
      resourceId: storyState.resourceId,
    });

    const storyText = storyResponse.text;

    const audioResponse = await agent.voice.speak(storyText);

    if (!audioResponse.body) {
      throw new Error('音声ストリームを受信できませんでした');
    }

    const audio = await readStream(audioResponse.body);

    setStoryState(prev => ({
      phase: 'beginning',
      threadId: prev.threadId,
      resourceId: prev.resourceId,
      content: {
        ...prev.content,
        beginning: storyText,
      },
    }));

    setAudioBlob(audio);
    return audio;
  } catch (error) {
    console.error('ストーリーの冒頭生成中にエラーが発生しました:', error);
  } finally {
    setIsLoading(false);
  }
};
```

## オーディオの再生 \{#playing-the-audio\}

このスニペットは、新しい音声データを監視し、テキスト読み上げ（TTS）の再生を処理する方法を示します。音声を受信すると、コードは音声のBlobからブラウザーで再生可能なURLを生成してaudio要素に設定し、自動再生を試みます。

```typescript filename="/app/components/StoryManager.tsx"
useEffect(() => {
  if (!audioRef.current || !audioData) return;

  // HTML audio要素への参照を保存
  const currentAudio = audioRef.current;

  // MastraからのBlob/Fileオーディオデータをブラウザで再生可能なURLに変換
  const url = URL.createObjectURL(audioData);

  const playAudio = async () => {
    try {
      currentAudio.src = url;
      await currentAudio.load();
      await currentAudio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('自動再生に失敗しました:', error);
    }
  };

  playAudio();

  return () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      URL.revokeObjectURL(url);
    }
  };
}, [audioData]);
```

Interactive Story Generator の完全版の実装は、GitHub リポジトリでご覧いただけます。

<br />

<br />

<hr className="dark:border-[#404040] border-gray-300" />

<br />

<br />

<GithubLink
  link={
"https://github.com/mastra-ai/voice-examples/tree/main/text-to-speech/interactive-story"
}
/>
