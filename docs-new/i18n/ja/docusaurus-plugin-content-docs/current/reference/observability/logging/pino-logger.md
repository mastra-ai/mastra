---
title: "PinoLogger "
description: PinoLogger のドキュメント。さまざまな重要度レベルでイベントを記録するためのメソッドを提供します。
---

# PinoLogger \{#pinologger\}

`new PinoLogger()` で Logger インスタンスを作成し、さまざまな重要度レベルでイベントを記録するメソッドを提供します。

Mastra Cloud へデプロイした場合、ログは [Logs](/docs/mastra-cloud/dashboard#logs) ページに表示されます。セルフホストや独自環境では、設定されたトランスポートに応じて、ログをファイルや外部サービスへ出力できます。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

export const mastra = new Mastra({
  // ...
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "このロガーのログをグループ化・識別するためのラベル。",
},
{
name: "level",
type: `"debug" | "info" | "warn" | "error"`,
description: "最小のログレベルを設定します。このレベル未満のメッセージは無視されます。",
},
{
name: "transports",
type: "Record<string, LoggerTransport>",
description: "ログを永続化するために使用するトランスポートインスタンスのマップ。",
},
{
name: "overrideDefaultTransports",
type: "boolean",
isOptional: true,
description: "true の場合、デフォルトのコンソールトランスポートを無効にします。",
},
{
name: "formatters",
type: "pino.LoggerOptions['formatters']",
isOptional: true,
description: "ログのシリアライズ用カスタム Pino フォーマッター。",
},
]}
/>

## ファイルトランスポート（構造化ログ） \{#file-transport-structured-logs\}

`FileTransport` を使って構造化ログをファイルに書き込みます。ロガーは、第1引数にプレーンなメッセージ、第2引数に構造化メタデータを受け取ります。これらは内部で `BaseLogMessage` に変換され、設定されたファイルパスに保存されます。

```typescript filename="src/mastra/loggers/file-transport.ts" showLineNumbers copy
import { FileTransport } from '@mastra/loggers/file';
import { PinoLogger } from '@mastra/loggers/pino';

export const fileLogger = new PinoLogger({
  name: 'Mastra',
  transports: { file: new FileTransport({ path: 'test-dir/test.log' }) },
  level: 'warn',
});
```

### ファイル転送の使い方 \{#file-transport-usage\}

```typescript showLineNumbers copy
fileLogger.warn('ディスクの空き容量が不足しています', {
  destinationPath: 'system',
  type: 'WORKFLOW',
});
```

## Upstash トランスポート（リモートログドレイン） \{#upstash-transport-remote-log-drain\}

`UpstashTransport` を使って、構造化ログをリモートの Redis リストへストリーミングします。ロガーは文字列メッセージと構造化メタデータオブジェクトを受け取ります。これにより、分散環境での集中ログ管理が可能になり、`destinationPath`、`type`、`runId` によるフィルタリングをサポートします。

```typescript filename="src/mastra/loggers/upstash-transport.ts" showLineNumbers copy
import { UpstashTransport } from '@mastra/loggers/upstash';
import { PinoLogger } from '@mastra/loggers/pino';

export const upstashLogger = new PinoLogger({
  name: 'Mastra',
  transports: {
    upstash: new UpstashTransport({
      listName: 'production-logs',
      upstashUrl: process.env.UPSTASH_URL!,
      upstashToken: process.env.UPSTASH_TOKEN!,
    }),
  },
  level: 'info',
});
```

### Upstash トランスポートの使い方 \{#upstash-transport-usage\}

```typescript showLineNumbers copy
upstashLogger.info('ユーザーがサインインしました', {
  destinationPath: 'auth',
  type: 'AGENT',
  runId: 'run_123',
});
```

## カスタムトランスポート \{#custom-transport\}

あらゆるログサービスやストリームと統合するために、`createCustomTransport` ユーティリティを使ってカスタムトランスポートを作成できます。

### Sentry トランスポートの例 \{#sentry-transport-example\}

`createCustomTransport` を使ってカスタムトランスポートを作成し、`pino-sentry-transport` のようなサードパーティのログ出力ストリームと統合します。これにより、Sentry などの外部システムにログを転送して、高度な監視と可観測性を実現できます。

```typescript filename="src/mastra/loggers/sentry-transport.ts" showLineNumbers copy
import { createCustomTransport } from '@mastra/core/loggers';
import { PinoLogger } from '@mastra/loggers/pino';
import pinoSentry from 'pino-sentry-transport';

const sentryStream = await pinoSentry({
  sentry: {
    dsn: 'YOUR_SENTRY_DSN',
    _experiments: {
      enableLogs: true,
    },
  },
});

const customTransport = createCustomTransport(sentryStream);

export const sentryLogger = new PinoLogger({
  name: 'Mastra',
  level: 'info',
  transports: { sentry: customTransport },
});
```
