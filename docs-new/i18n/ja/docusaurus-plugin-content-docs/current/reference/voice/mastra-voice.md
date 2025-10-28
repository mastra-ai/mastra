---
title: "リファレンス: MastraVoice"
description: "Mastra のすべての音声サービスに共通するコアインターフェースを定義し、音声同士の変換機能も含む、MastraVoice 抽象基底クラスのドキュメント。"
---

# MastraVoice \{#mastravoice\}

MastraVoice クラスは、Mastra における音声サービスの中核となるインターフェースを定義する抽象基底クラスです。すべての音声プロバイダー実装（OpenAI、Deepgram、PlayAI、Speechify など）は、このクラスを継承して各プロバイダー固有の機能を提供します。現在、このクラスは WebSocket 接続を介したリアルタイムの音声から音声への変換（speech-to-speech）機能をサポートしています。

## 使い方の例 \{#usage-example\}

```typescript
import { MastraVoice } from '@mastra/core/voice';

// 音声プロバイダーの実装を作成
class MyVoiceProvider extends MastraVoice {
  constructor(config: {
    speechModel?: BuiltInModelConfig;
    listeningModel?: BuiltInModelConfig;
    speaker?: string;
    realtimeConfig?: {
      model?: string;
      apiKey?: string;
      options?: unknown;
    };
  }) {
    super({
      speechModel: config.speechModel,
      listeningModel: config.listeningModel,
      speaker: config.speaker,
      realtimeConfig: config.realtimeConfig,
    });
  }

  // 必須の抽象メソッドを実装
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: { speaker?: string },
  ): Promise<NodeJS.ReadableStream | void> {
    // テキスト読み上げ変換を実装
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: unknown): Promise<string | NodeJS.ReadableStream | void> {
    // 音声認識変換を実装
  }

  async getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: unknown }>> {
    // 利用可能な音声のリストを返す
  }

  // オプションの音声間通信メソッド
  async connect(): Promise<void> {
    // 音声間通信用のWebSocket接続を確立
  }

  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    // 音声間通信で音声データをストリーミング
  }

  async answer(): Promise<void> {
    // 音声プロバイダーに応答をトリガー
  }

  addTools(tools: Array<unknown>): void {
    // 音声プロバイダーが使用するツールを追加
  }

  close(): void {
    // WebSocket接続を閉じる
  }

  on(event: string, callback: (data: unknown) => void): void {
    // イベントリスナーを登録
  }

  off(event: string, callback: (data: unknown) => void): void {
    // イベントリスナーを削除
  }
}
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "config",
type: "VoiceConfig",
description: "音声サービス用の設定オブジェクト",
isOptional: true,
},
{
name: "config.speechModel",
type: "BuiltInModelConfig",
description: "テキスト読み上げ（Text-to-Speech）モデルの設定",
isOptional: true,
},
{
name: "config.listeningModel",
type: "BuiltInModelConfig",
description: "音声認識（Speech-to-Text）モデルの設定",
isOptional: true,
},
{
name: "config.speaker",
type: "string",
description: "使用するデフォルトの話者／ボイス ID",
isOptional: true,
},
{
name: "config.name",
type: "string",
description: "ボイスプロバイダーインスタンスの名前",
isOptional: true,
},
{
name: "config.realtimeConfig",
type: "object",
description: "リアルタイムの音声対音声機能の設定",
isOptional: true,
},
]}
/>

### BuiltInModelConfig \{#builtinmodelconfig\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "使用するモデル名",
isOptional: false,
},
{
name: "apiKey",
type: "string",
description: "モデルサービスの API キー",
isOptional: true,
},
]}
/>

### RealtimeConfig \{#realtimeconfig\}

<PropertiesTable
  content={[
{
name: "model",
type: "string",
description: "リアルタイムの音声対音声機能に使用するモデル",
isOptional: true,
},
{
name: "apiKey",
type: "string",
description: "リアルタイムサービス用の API キー",
isOptional: true,
},
{
name: "options",
type: "unknown",
description: "リアルタイム機能向けのプロバイダー固有オプション",
isOptional: true,
},
]}
/>

## 抽象メソッド \{#abstract-methods\}

これらのメソッドは、MastraVoice を継承する任意のクラスで実装する必要があります。

### speak() \{#speak\}

設定された音声モデルを使って、テキストを音声に変換します。

```typescript
abstract speak(
  input: string | NodeJS.ReadableStream,
  options?: {
    speaker?: string;
    [key: string]: unknown;
  }
): Promise<NodeJS.ReadableStream | void>
```

目的:

* テキスト入力を受け取り、プロバイダーのテキスト読み上げサービスで音声に変換する
* 柔軟性のため、文字列入力とストリーム入力の両方に対応する
* オプションで既定の話者／音声を上書きできる
* 再生や保存が可能な音声データのストリームを返す
* 音声が「speaking」イベントの発行によって処理される場合は、void を返すことがある

### listen() \{#listen\}

設定されたリスニングモデルを使用して、音声をテキストに変換します。

```typescript
abstract listen(
  audioStream: NodeJS.ReadableStream,
  options?: {
    [key: string]: unknown;
  }
): Promise<string | NodeJS.ReadableStream | void>
```

目的:

* 音声ストリームを受け取り、プロバイダーの音声認識（speech-to-text）サービスでテキストに変換します
* 文字起こし設定用のプロバイダー固有オプションをサポートします
* 完全なテキストの文字起こしか、文字起こしテキストのストリームのいずれかを返せます
* すべてのプロバイダーがこの機能をサポートしているわけではありません（例：PlayAI、Speechify）
* 文字起こしが「writing」イベントの発行で処理される場合、void を返すことがあります

### getSpeakers() \{#getspeakers\}

プロバイダーがサポートする利用可能なボイスの一覧を返します。

```typescript
abstract getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: unknown }>>
```

目的:

* プロバイダーから利用可能な声/スピーカーの一覧を取得する
* 各声には、少なくとも `voiceId` プロパティが必要
* プロバイダーは各声に関する追加のメタデータを含められる
* テキスト読み上げ（TTS）用に利用可能な声を把握するために使用される

## オプションのメソッド \{#optional-methods\}

これらのメソッドには既定の実装がありますが、スピーチ・ツー・スピーチ機能に対応した音声プロバイダーであれば上書き（オーバーライド）できます。

### connect() \{#connect\}

通信のために WebSocket または WebRTC の接続を確立します。

```typescript
connect(config?: unknown): Promise<void>
```

Purpose:

* 音声サービスとの通信に必要な接続を初期化する
* send() や answer() などの機能を使う前に必ず呼び出す
* 接続が確立されると解決される Promise を返す
* 設定はプロバイダーによって異なる

### send() \{#send\}

音声データを音声プロバイダーにリアルタイムでストリーミングします。

```typescript
send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void>
```

Purpose:

* 音声データを音声プロバイダーに送信し、リアルタイムで処理します
* ライブのマイク入力など、連続的な音声ストリーミングのシナリオに有用です
* ReadableStream と Int16Array の両方の音声形式をサポートします
* このメソッドを呼び出す前に、接続済みの状態である必要があります

### answer() \{#answer\}

音声プロバイダーに応答の生成を指示します。

```typescript
answer(): Promise<void>
```

目的:

* 音声プロバイダーに応答生成のシグナルを送る
* リアルタイムの会話で、AIの応答を促すために使用する
* 応答はイベントシステム（例: ‘speaking’ イベント）を通じて送出される

### addTools() \{#addtools\}

会話中に使用するツールを音声プロバイダーに追加します。

```typescript
addTools(tools: Array<Tool>): void
```

目的:

* 音声プロバイダーが会話中に利用できるツールを追加します
* ツールによって音声プロバイダーの機能を拡張できます
* 実装はプロバイダーごとに異なります

### close() \{#close\}

WebSocket または WebRTC の接続を切断します。

```typescript
close(): void
```

目的:

* 音声サービスへの接続を終了します
* リソースを解放し、進行中のリアルタイム処理を停止します
* 音声インスタンスの使用を終えたら呼び出してください

### on() \{#on\}

音声イベントのリスナーを登録します。

```typescript
on<E extends VoiceEventType>(
  event: E,
  callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
): void
```

目的:

* 指定したイベントの発生時に呼び出されるコールバック関数を登録します
* 標準イベントには &#39;speaking&#39;、&#39;writing&#39;、&#39;error&#39; が含まれます
* プロバイダーは独自のカスタムイベントも発行できます
* イベントデータの構造はイベントの種類によって異なります

### off() \{#off\}

イベントリスナーを解除します。

```typescript
off<E extends VoiceEventType>(
  event: E,
  callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
): void
```

目的:

* 以前に登録したイベントリスナーを削除します
* 不要になったイベントハンドラーを後処理（クリーンアップ）するために使用します

## イベントシステム \{#event-system\}

MastraVoice クラスには、リアルタイム通信のためのイベントシステムが用意されています。標準的なイベントタイプは次のとおりです。

<PropertiesTable
  content={[
{
name: "speaking",
type: "{ text: string; audioStream?: NodeJS.ReadableStream; audio?: Int16Array }",
description:
"ボイスプロバイダーが発話中に発行され、音声データを含みます",
},
{
name: "writing",
type: "{ text: string, role: string }",
description: "音声がテキストに書き起こされた際に発行されます",
},
{
name: "error",
type: "{ message: string; code?: string; details?: unknown }",
description: "エラー発生時に発行されます",
},
]}
/>

## 保護されたプロパティ \{#protected-properties\}

<PropertiesTable
  content={[
{
name: "listeningModel",
type: "BuiltInModelConfig | undefined",
description: "音声認識モデルの設定",
isOptional: true,
},
{
name: "speechModel",
type: "BuiltInModelConfig | undefined",
description: "音声合成モデルの設定",
isOptional: true,
},
{
name: "speaker",
type: "string | undefined",
description: "既定のスピーカー／ボイスID",
isOptional: true,
},
{
name: "realtimeConfig",
type: "{ model?: string; apiKey?: string; options?: unknown } | undefined",
description: "リアルタイム音声対音声機能の設定",
isOptional: true,
},
]}
/>

## テレメトリーのサポート \{#telemetry-support\}

MastraVoice には、メソッド呼び出しをパフォーマンス計測とエラー監視付きでラップする `traced` メソッドによるテレメトリーの組み込みサポートが用意されています。

## 注意事項 \{#notes\}

* MastraVoice は抽象クラスであり、直接インスタンス化できません
* 実装は、すべての抽象メソッドに対して具体的な実装を提供する必要があります
* このクラスは、異なる音声サービスプロバイダー間で一貫したインターフェースを提供します
* 音声同士の変換（speech-to-speech）機能は任意で、プロバイダー固有です
* イベントシステムにより、リアルタイムのやり取りにおける非同期通信が可能です
* すべてのメソッド呼び出しについて、テレメトリは自動的に処理されます