---
title: "CLI コマンド"
description: プロジェクトの開発・ビルド・起動に使用する Mastra CLI のドキュメントです。
---

# CLI コマンド \{#cli-commands\}

Mastra が提供するコマンドラインインターフェース（CLI）を使って、Mastra プロジェクトの開発・ビルド・起動を行えます。

## `mastra dev` \{#mastra-dev\}

[ローカル開発プレイグラウンド](/docs/getting-started/local-dev-playground) と、エージェント・ツール・ワークフロー向けの REST エンドポイントを公開するサーバーを起動します。`mastra dev` を実行すると、[http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui) で利用可能なエンドポイントの一覧を確認できます。

[サーバー設定](/docs/getting-started/local-dev-playground#configuration)も行えます。

### フラグ \{#flags\}

このコマンドは[共通フラグ][common-flags]に加えて、次の追加フラグも受け付けます：

#### `--https` \{#https\}

ローカル HTTPS サポートを有効にします。詳しくは[こちら](/docs/getting-started/local-dev-playground#local-https)。

#### `--inspect` \{#inspect\}

デバッグに役立つインスペクトモードで開発サーバーを起動します。これは `--inspect-brk` と同時には使用できません。

#### `--inspect-brk` \{#inspect-brk\}

開発サーバーをインスペクトモードで起動し、スクリプトの冒頭で一時停止します。これは `--inspect` と同時には使用できません。

#### `--custom-args` \{#custom-args\}

開発サーバーに渡すカスタム引数をカンマ区切りで指定します。Node.js プロセスに対する引数も指定できます（例：`--experimental-transform-types`）。

### 設定 \{#configs\}

`mastra dev` の動作を変更するために、特定の環境変数を設定できます。

#### ビルドキャッシュを無効化する \{#disable-build-caching\}

`.mastra/` 配下のキャッシュ済みアセットを使わず、フルリビルドを強制するには `MASTRA_DEV_NO_CACHE=1` を設定します:

```bash copy
MASTRA_DEV_NO_CACHE=1 mastra dev
```

これは、バンドラのプラグインをデバッグしているときや、出力の陳腐化を疑う場合に役立ちます。

#### 並列実行の制限 \{#limit-parallelism\}

`MASTRA_CONCURRENCY` は、並列で実行される高コストな処理（主にビルドおよび評価ステップ）の同時実行数の上限を設定します。たとえば：

```bash copy
MASTRA_CONCURRENCY=4 mastra dev
```

未設定のままにすると、CLI がそのマシンに適したデフォルトを自動的に選択します。

#### カスタムプロバイダーのエンドポイント \{#custom-provider-endpoints\}

Vercel AI SDK がサポートするプロバイダーを使用する場合、ベース URL を設定することで、プロキシや内部ゲートウェイ経由でリクエストをリダイレクトできます。OpenAI の場合:

```bash copy
OPENAI_API_KEY=<あなたのAPIキー> \
OPENAI_BASE_URL=https://openrouter.example/v1 \
mastra dev
```

Anthropic の場合:

```bash copy
ANTHROPIC_API_KEY=<your-api-key> \
ANTHROPIC_BASE_URL=https://anthropic.internal \
mastra dev
```

これらは AI SDK によって引き渡され、どの `openai()` や `anthropic()` の呼び出しでも機能します。

## `mastra build` \{#mastra-build\}

`mastra build` コマンドは、Mastra プロジェクトを本番運用可能な Hono サーバーにバンドルします。[Hono](https://hono.dev/) は軽量で型安全な Web フレームワークで、ミドルウェア対応の HTTP エンドポイントとして Mastra エージェントを簡単にデプロイできます。

内部的には、Mastra の Rollup サーバーが Mastra のエントリーファイルを検出し、本番運用向けの Hono サーバーへバンドルします。バンドルの過程ではコードのツリーシェイキングを行い、デバッグ用のソースマップを生成します。

`.mastra` に出力される成果物は、[`mastra start`](#mastra-start) を使って任意のクラウドサーバーにデプロイできます。

[サーバーレスプラットフォーム](/docs/deployment/serverless-platforms/overview) へデプロイする場合は、`.mastra` に正しい出力を得るために、適切なデプロイヤーをインストールする必要があります。

[共通フラグ][common-flags] を受け付けます。

### 設定 \{#configs\}

`mastra build` の動作を変更するために、特定の環境変数を設定できます。

#### 並列実行数を制限する \{#limit-parallelism\}

CI 環境やリソースが限られた環境で実行する場合は、`MASTRA_CONCURRENCY` を設定して、一度に走らせる高負荷タスクの数に上限を設けられます。

```bash copy
MASTRA_CONCURRENCY=2 mastra build
```

## `mastra start` \{#mastra-start\}

:::note

`mastra start` を使用する前に、`mastra build` を実行する必要があります。

:::

本番モードでビルド済みの Mastra アプリケーションを配信するローカルサーバーを起動します。既定では [OTEL Tracing](/docs/observability/otel-tracing) が有効です。

### フラグ \{#flags\}

このコマンドは[共通フラグ][common-flags]に加えて、次の追加フラグを受け付けます：

#### `--dir` \{#dir\}

ビルド済みの Mastra の出力ディレクトリへのパス。既定値は `.mastra/output` です。

#### `--no-telemetry` \{#no-telemetry\}

[OTEL Tracing](/docs/observability/otel-tracing) を無効にします。

## `mastra lint` \{#mastra-lint\}

`mastra lint` コマンドは、Mastra プロジェクトの構造とコードを検証し、ベストプラクティスに沿っており、エラーがないことを確認します。

[共通のフラグ][common-flags] を受け付けます。

## `mastra scorers` \{#mastra-scorers\}

`mastra scorers` コマンドは、AI 生成出力の品質・正確性・パフォーマンスを評価するスコアラーの管理を行うための機能を提供します。

詳しくは [Scorers の概要](/docs/scorers/overview) をご覧ください。

### `add` \{#add\}

プロジェクトに新しいスコアラーを追加します。対話型プロンプトを使用できます：

```bash copy
mastra scorers を追加
```

またはスコアラー名を直接入力します：

```bash copy
mastra のスコアラーに answer-relevancy を追加
```

正しいIDを取得するには、[`list`](#list) コマンドを使用してください。

### `list` \{#list\}

利用可能なスコアラーテンプレートをすべて一覧表示します。`add` コマンドではその ID を使用します。

## `mastra init` \{#mastra-init\}

`mastra init` コマンドは、既存のプロジェクトに Mastra を初期設定します。新しいプロジェクトを一から作成することなく、必要なフォルダと設定を自動生成するために使用します。

### フラグ \{#flags\}

このコマンドでは、次の追加フラグを使用できます：

#### `--default` \{#default\}

OpenAI を使用して `src` 内にファイルを作成します。さらに、`src/mastra` フォルダーにサンプルコードを配置します。

#### `--dir` \{#dir\}

Mastra のファイルを保存するディレクトリ。デフォルトは `src` です。

#### `--components` \{#components\}

追加するコンポーネントをカンマ区切りで指定します。各コンポーネントに対して新しいフォルダが作成されます。既定値は `['agents', 'tools', 'workflows']` です。

#### `--llm` \{#llm\}

デフォルトのモデルプロバイダー。選べる値: `"openai" | "anthropic" | "groq" | "google" | "cerebras" | "mistral"`。

#### `--llm-api-key` \{#llm-api-key\}

選択したモデルプロバイダーの API キー。環境変数ファイル（`.env`）に書き込まれます。

#### `--example` \{#example\}

有効にすると、サンプルコード（例：エージェントのサンプルコード）がコンポーネントの一覧に出力されます。

#### `--no-example` \{#no-example\}

サンプルコードを含めません。`--default` フラグを使う場合に便利です。

#### `--mcp` \{#mcp\}

Mastra の MCP サーバーを使ってコードエディターを設定します。選択肢: `"cursor" | "cursor-global" | "windsurf" | "vscode"`。

## よく使われるフラグ \{#common-flags\}

### `--dir` \{#dir\}

**利用可能:** `dev`, `build`, `lint`

Mastra フォルダーへのパス。既定値は `src/mastra`。

### `--env` \{#env\}

**利用可能:** `dev`, `build`, `start`

追加で読み込むカスタム環境変数ファイル。デフォルトでは `.env.development`、`.env.local`、`.env` が含まれます。

### `--root` \{#root\}

**利用可能:** `dev`, `build`, `lint`

プロジェクトのルートフォルダーへのパス。既定値は `process.cwd()` です。

### `--tools` \{#tools\}

**利用可能:** `dev`, `build`, `lint`

含めるツールのパスをカンマ区切りで指定します。既定値は `src/mastra/tools` です。

## グローバルフラグ \{#global-flags\}

`mastra` CLI に関する情報を確認するには、これらのフラグを使用します。

### `--version` \{#version\}

Mastra CLI のバージョンを表示して終了します。

### `--help` \{#help\}

ヘルプメッセージを表示して終了します。

## テレメトリー \{#telemetry\}

既定では、Mastra は OS、Mastra のバージョン、Node.js のバージョンなど、プロジェクトに関する匿名情報を収集します。収集内容は [ソースコード](https://github.com/mastra-ai/mastra/blob/main/packages/cli/src/analytics/index.ts)で確認できます。

環境変数を設定することで、CLI のテレメトリーを無効化（オプトアウト）できます。

```bash copy
MASTRA_TELEMETRY_DISABLED=1
```

他の `mastra` コマンドを使用中でも、これを設定できます。

```bash copy
MASTRA_TELEMETRY_DISABLED=1 mastra dev
```

[common-flags]: #common-flags
