---
title: "リファレンス: Google Gemini Live Voice"
description: "GeminiLiveVoice クラスのドキュメント。Google の Gemini Live API を利用し、Gemini API と Vertex AI の両方に対応した、リアルタイムのマルチモーダル音声対話を提供します。"
---

# Google Gemini Live Voice \{#google-gemini-live-voice\}

GeminiLiveVoice クラスは、Google の Gemini Live API を用いて、リアルタイムの音声対話機能を提供します。双方向の音声ストリーミング、ツール呼び出し、セッション管理に対応し、標準の Google API と Vertex AI の両方の認証方式をサポートします。

## 使い方の例 \{#usage-example\}

```typescript
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';
import { playAudio, getMicrophoneStream } from '@mastra/node-audio';

// Gemini API を使って初期化（API キー使用）
const voice = new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY, // Gemini API に必須
  model: 'gemini-2.0-flash-exp',
  speaker: 'Puck', // 既定の音声
  debug: true,
});

// もしくは Vertex AI で初期化（OAuth 使用）
const voiceWithVertexAI = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
  serviceAccountKeyFile: '/path/to/service-account.json',
  model: 'gemini-2.0-flash-exp',
  speaker: 'Puck',
});

// あるいは VoiceConfig パターンを使用（他プロバイダーとの一貫性のため推奨）
const voiceWithConfig = new GeminiLiveVoice({
  speechModel: {
    name: 'gemini-2.0-flash-exp',
    apiKey: process.env.GOOGLE_API_KEY,
  },
  speaker: 'Puck',
  realtimeConfig: {
    model: 'gemini-2.0-flash-exp',
    apiKey: process.env.GOOGLE_API_KEY,
    options: {
      debug: true,
      sessionConfig: {
        interrupts: { enabled: true },
      },
    },
  },
});

// 接続を確立（他のメソッドを使う前に必要）
await voice.connect();

// イベントリスナーを設定
voice.on('speaker', audioStream => {
  // オーディオストリームを処理（NodeJS.ReadableStream）
  playAudio(audioStream);
});

voice.on('writing', ({ text, role }) => {
  // 書き起こしテキストを処理
  console.log(`${role}: ${text}`);
});

  // ターン完了を処理
  // Handle turn completion
  console.log('ターン完了時刻:', timestamp);
});

// テキストを音声に変換
await voice.speak('こんにちは。本日どのようにお手伝いできますか？', {
  speaker: 'Charon', // 既定の音声を上書き
  responseModalities: ['AUDIO', 'TEXT'],
});

// 音声入力を処理
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);

// セッション設定を更新
await voice.updateSessionConfig({
  speaker: 'Kore',
  instructions: '回答はより簡潔にしてください',
});

// 終了時に切断
await voice.disconnect();
// あるいは同期ラッパーを使用
voice.close();
```

## 設定 \{#configuration\}

### コンストラクタのオプション \{#constructor-options\}

<PropertiesTable
  content={[
{
name: "apiKey",
type: "string",
description:
"Gemini API の認証に使用する Google API キー。Vertex AI を使用しない場合は必須です。",
isOptional: true,
},
{
name: "model",
type: "GeminiVoiceModel",
description: "リアルタイム音声対話に使用するモデル ID。",
isOptional: true,
defaultValue: "'gemini-2.0-flash-exp'",
},
{
name: "speaker",
type: "GeminiVoiceName",
description: "音声合成のデフォルト音声 ID。",
isOptional: true,
defaultValue: "'Puck'",
},
{
name: "vertexAI",
type: "boolean",
description: "認証に Gemini API の代わりに Vertex AI を使用します。",
isOptional: true,
defaultValue: "false",
},
{
name: "project",
type: "string",
description: "Google Cloud プロジェクト ID（Vertex AI で必須）。",
isOptional: true,
},
{
name: "location",
type: "string",
description: "Vertex AI 用の Google Cloud リージョン。",
isOptional: true,
defaultValue: "'us-central1'",
},
{
name: "serviceAccountKeyFile",
type: "string",
description:
"Vertex AI の認証に使用するサービス アカウントの JSON キー ファイルへのパス。",
isOptional: true,
},
{
name: "serviceAccountEmail",
type: "string",
description:
"偽装用のサービス アカウントのメールアドレス（キー ファイルの代替）。",
isOptional: true,
},
{
name: "instructions",
type: "string",
description: "モデルへのシステム指示。",
isOptional: true,
},
{
name: "sessionConfig",
type: "GeminiSessionConfig",
description: "割り込みやコンテキスト設定を含むセッション設定。",
isOptional: true,
},
{
name: "debug",
type: "boolean",
description: "トラブルシューティング用のデバッグ ログを有効にします。",
isOptional: true,
defaultValue: "false",
},
]}
/>

### セッション設定 \{#session-configuration\}

<PropertiesTable
  content={[
{
name: "interrupts",
type: "object",
description: "割り込み処理の設定。",
isOptional: true,
},
{
name: "interrupts.enabled",
type: "boolean",
description: "割り込み処理を有効にする。",
isOptional: true,
defaultValue: "true",
},
{
name: "interrupts.allowUserInterruption",
type: "boolean",
description: "ユーザーがモデルの応答を中断できるようにする。",
isOptional: true,
defaultValue: "true",
},
{
name: "contextCompression",
type: "boolean",
description: "コンテキストの自動圧縮を有効にする。",
isOptional: true,
defaultValue: "false",
},
]}
/>

## メソッド \{#methods\}

### connect() \{#connect\}

Gemini Live API への接続を確立します。`speak`、`listen`、`send` メソッドを使用する前に呼び出す必要があります。

<PropertiesTable
  content={[
{
name: "runtimeContext",
type: "object",
description: "接続用の任意のランタイムコンテキスト。",
isOptional: true,
},
{
name: "returns",
type: "Promise<void>",
description: "接続が確立された時に解決される Promise。",
},
]}
/>

### speak() \{#speak\}

テキストを音声に変換してモデルへ送信します。入力は文字列または読み取り可能なストリームを受け付けます。

<PropertiesTable
  content={[
{
name: "input",
type: "string | NodeJS.ReadableStream",
description: "音声に変換するテキスト、またはテキストのストリーム。",
isOptional: false,
},
{
name: "options",
type: "GeminiLiveVoiceOptions",
description: "任意の音声設定。",
isOptional: true,
},
{
name: "options.speaker",
type: "GeminiVoiceName",
description: "この音声リクエストに使用する音声のID。",
isOptional: true,
defaultValue: "Constructor's speaker value",
},
{
name: "options.languageCode",
type: "string",
description: "レスポンスの言語コード。",
isOptional: true,
},
{
name: "options.responseModalities",
type: "('AUDIO' | 'TEXT')[]",
description: "モデルから受け取るレスポンスのモダリティ。",
isOptional: true,
defaultValue: "['AUDIO', 'TEXT']",
},
]}
/>

戻り値: `Promise<void>`（レスポンスは `speaker` および `writing` イベント経由で送出されます）

### listen() \{#listen\}

音声認識のために音声入力を処理します。読み取り可能な音声データのストリームを受け取り、文字起こしされたテキストを返します。

<PropertiesTable
  content={[
{
name: "audioStream",
type: "NodeJS.ReadableStream",
description: "文字起こし対象の音声ストリーム。",
isOptional: false,
},
{
name: "options",
type: "GeminiLiveVoiceOptions",
description: "任意のリスニング設定。",
isOptional: true,
},
]}
/>

戻り値: `Promise<string>` - 文字起こしされたテキスト

### send() \{#send\}

ライブのマイク入力など、連続的な音声ストリーミングのシナリオで、オーディオデータをリアルタイムに Gemini サービスへストリーミングします。

<PropertiesTable
  content={[
{
name: "audioData",
type: "NodeJS.ReadableStream | Int16Array",
description: "サービスに送信する音声ストリームまたはバッファ。",
isOptional: false,
},
]}
/>

Returns: `Promise<void>`

### updateSessionConfig() \{#updatesessionconfig\}

セッション設定を動的に更新します。音声設定、話者の選択、その他のランタイム設定を変更するために使用できます。

<PropertiesTable
  content={[
{
name: "config",
type: "Partial<GeminiLiveVoiceConfig>",
description: "適用する設定の更新内容。",
isOptional: false,
},
]}
/>

Returns: `Promise<void>`

### addTools() \{#addtools\}

ボイスインスタンスにツールのセットを追加します。ツールにより、モデルは会話中に追加のアクションを実行できます。GeminiLiveVoice を Agent に追加すると、Agent に構成されたツールはすべて自動的にボイスインターフェースで利用可能になります。

<PropertiesTable
  content={[
{
name: "tools",
type: "ToolsInput",
description: "適用するツールの構成。",
isOptional: false,
},
]}
/>

戻り値: `void`

### addInstructions() \{#addinstructions\}

モデル向けのシステム命令を追加または更新します。

<PropertiesTable
  content={[
{
name: "instructions",
type: "string",
description: "設定するシステム命令。",
isOptional: true,
},
]}
/>

Returns: `void`

### answer() \{#answer\}

モデルに応答を発生させます。このメソッドは、Agent と統合されている場合に主に内部的に使用されます。

<PropertiesTable
  content={[
{
name: "options",
type: "Record<string, unknown>",
description: "answer リクエストのためのオプションのパラメータ。",
isOptional: true,
},
]}
/>

Returns: `Promise<void>`

### getSpeakers() \{#getspeakers\}

Gemini Live API で利用可能な音声ボイスの一覧を返します。

Returns: `Promise<Array<{ voiceId: string; description?: string }>>`

### disconnect() \{#disconnect\}

Gemini Live セッションから切断し、リソースを解放します。クリーンアップを適切に行う非同期メソッドです。

Returns: `Promise<void>`

### close() \{#close\}

disconnect() の同期ラッパー。内部で await せずに disconnect() を呼び出します。

戻り値: `void`

### on() \{#on\}

音声イベントのリスナーを登録します。

<PropertiesTable
  content={[
{
name: "event",
type: "string",
description: "リッスンするイベント名。",
isOptional: false,
},
{
name: "callback",
type: "Function",
description: "イベント発生時に呼び出される関数。",
isOptional: false,
},
]}
/>

戻り値: `void`

### off() \{#off\}

以前に登録したイベントリスナーを解除します。

<PropertiesTable
  content={[
{
name: "event",
type: "string",
description: "リスニングを停止するイベント名。",
isOptional: false,
},
{
name: "callback",
type: "Function",
description: "削除する対象のコールバック関数。",
isOptional: false,
},
]}
/>

戻り値: `void`

## イベント \{#events\}

GeminiLiveVoice クラスは次のイベントを発生させます:

<PropertiesTable
  content={[
{
name: "speaker",
type: "event",
description:
"モデルから音声データを受信したときに発生します。コールバックは NodeJS.ReadableStream を受け取ります。",
},
{
name: "speaking",
type: "event",
description:
"音声メタデータとともに発生します。コールバックは { audioData?: Int16Array, sampleRate?: number } を受け取ります。",
},
{
name: "writing",
type: "event",
description:
"書き起こしテキストが利用可能になったときに発生します。コールバックは { text: string, role: 'assistant' | 'user' } を受け取ります。",
},
{
name: "session",
type: "event",
description:
"セッションの状態が変化したときに発生します。コールバックは { state: 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'updated', config?: object } を受け取ります。",
},
{
name: "turnComplete",
type: "event",
description:
"会話のターンが完了したときに発生します。コールバックは { timestamp: number } を受け取ります。",
},
{
name: "toolCall",
type: "event",
description:
"モデルがツールの呼び出しを要求したときに発生します。コールバックは { name: string, args: object, id: string } を受け取ります。",
},
{
name: "usage",
type: "event",
description:
"トークン使用状況とともに発生します。コールバックは { inputTokens: number, outputTokens: number, totalTokens: number, modality: string } を受け取ります。",
},
{
name: "error",
type: "event",
description:
"エラーが発生したときに発生します。コールバックは { message: string, code?: string, details?: unknown } を受け取ります。",
},

  {
    name: "interrupt",
    type: "event",
    description:
      "割り込みイベント。コールバックは { type: 'user' | 'model', timestamp: number } を受け取ります。",
  },

]}
/>

## 利用可能なモデル \{#available-models\}

次の Gemini Live モデルを利用できます:

* `gemini-2.0-flash-exp`（デフォルト）
* `gemini-2.0-flash-exp-image-generation`
* `gemini-2.0-flash-live-001`
* `gemini-live-2.5-flash-preview-native-audio`
* `gemini-2.5-flash-exp-native-audio-thinking-dialog`
* `gemini-live-2.5-flash-preview`
* `gemini-2.6.flash-preview-tts`

## 利用可能なボイス \{#available-voices\}

利用可能なボイスのオプションは次のとおりです。

* `Puck`（デフォルト）: 会話的で親しみやすい
* `Charon`: 低く、威厳がある
* `Kore`: 中立的でプロフェッショナル
* `Fenrir`: 温かみがあり、親しみやすい

## 認証方法 \{#authentication-methods\}

### Gemini API（開発） \{#gemini-api-development\}

[Google AI Studio](https://makersuite.google.com/app/apikey) の API キーを使った最も簡単な方法：

```typescript
const voice = new GeminiLiveVoice({
  apiKey: 'あなたのAPIキー', // Gemini API に必要
  model: 'gemini-2.0-flash-exp',
});
```

### Vertex AI（本番運用） \{#vertex-ai-production\}

OAuth 認証と Google Cloud Platform を用いた本番運用向け:

```typescript
// サービス アカウントのキー ファイルを使用する
const voice = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
  serviceAccountKeyFile: '/path/to/service-account.json',
});

// アプリケーション デフォルト認証情報（ADC）を使用する
const voice = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
});

// サービス アカウントのなりすまし（インパーソネーション）を使用する
const voice = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
  serviceAccountEmail: 'service-account@project.iam.gserviceaccount.com',
});
```

## 先進的な機能 \{#advanced-features\}

### セッション管理 \{#session-management\}

Gemini Live API は、ネットワーク障害時のセッション再開に対応しています。

```typescript
voice.on('sessionHandle', ({ handle, expiresAt }) => {
  // セッション再開用にハンドルを保存する
  saveSessionHandle(handle, expiresAt);
});

// 前回のセッションを再開する
const voice = new GeminiLiveVoice({
  sessionConfig: {
    enableResumption: true,
    maxDuration: '2h',
  },
});
```

### ツール呼び出し \{#tool-calling\}

会話中にモデルが関数を呼び出せるようにする:

```typescript
import { z } from 'zod';

voice.addTools({
  weather: {
    description: '天気情報を取得',
    parameters: z.object({
      location: z.string(),
    }),
    execute: async ({ location }) => {
      const weather = await getWeather(location);
      return weather;
    },
  },
});

voice.on('toolCall', ({ name, args, id }) => {
  console.log(`ツールが呼び出されました: ${name}、引数:`, args);
});
```

## 注意事項 \{#notes\}

* Gemini Live API はリアルタイム通信に WebSocket を使用します
* 音声は入力が 16 kHz の PCM16、出力が 24 kHz の PCM16 として処理されます
* 他のメソッドを使用する前に、音声インスタンスは `connect()` で接続しておく必要があります
* リソースを適切に解放するため、処理が終わったら必ず `close()` を呼び出してください
* Vertex AI の認証には適切な IAM 権限（`aiplatform.user` ロール）が必要です
* セッション再開により、ネットワーク断から復旧できます
* この API はテキストおよび音声によるリアルタイムの対話をサポートします