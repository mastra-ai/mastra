---
title: サーバーのデプロイ
description: 'ビルド設定とデプロイオプションを使用して Mastra サーバーをデプロイする方法を学びます。'
sidebar_position: 2
---

# Mastra サーバーをデプロイする \{#deploy-a-mastra-server\}

Mastra は標準的な Node.js サーバーとして動作し、さまざまな環境にデプロイできます。

## デフォルトのプロジェクト構成 \{#default-project-structure\}

[クイックスタートガイド](/docs/getting-started/installation)は、すぐに始められるよう妥当なデフォルト設定でプロジェクトの雛形を作成します。デフォルトでは、CLI はアプリケーションのファイルを `src/mastra/` ディレクトリ配下に整理し、次のような構成になります。

> ファイル構成の情報は公開されています。詳細なツリー表示は原典のドキュメントをご参照ください。

## ビルド \{#building\}

`mastra build` コマンドでビルド処理を開始します。

```bash copy
mastra build
```

### 入力ディレクトリのカスタマイズ \{#customizing-the-input-directory\}

Mastra のファイルが別の場所にある場合は、`--dir` フラグで任意の場所を指定します。`--dir` フラグは、エントリポイントのファイル（`index.ts` または `index.js`）と関連ディレクトリの場所を Mastra に知らせます。

```bash copy
mastra build --dir ./my-project/mastra
```

## ビルドプロセス \{#build-process\}

ビルドプロセスは次の手順で進みます:

1. **エントリーファイルの特定**: 指定したディレクトリ内の `index.ts` または `index.js` を探索します（既定: `src/mastra/`）。
2. **ビルドディレクトリの作成**: 次を含む `.mastra/` ディレクトリを生成します:
   * **`.build`**: 依存関係の分析結果、バンドル済みの依存関係、ビルド設定ファイルを格納します。
   * **`output`**: `index.mjs`、`instrumentation.mjs`、およびプロジェクト固有のファイルを含む、本番準備完了のアプリケーションバンドルを格納します。
3. **静的アセットのコピー**: `public/` フォルダの内容を、静的ファイル配信用に `output` ディレクトリへコピーします。
4. **コードのバンドル**: 最適化のため、ツリーシェイキングとソースマップを有効にした Rollup を使用します。
5. **サーバーの生成**: デプロイ可能な [Hono](https://hono.dev) 製の HTTP サーバーを作成します。

### ビルド出力の構成 \{#build-output-structure\}

ビルド後、Mastra は次の構成で `.mastra/` ディレクトリを作成します：

> ファイル構成に関する情報は利用可能です。詳細なツリー表示については元のドキュメントを参照してください。

### `public` フォルダー \{#public-folder\}

`src/mastra` に `public` フォルダーが存在する場合、ビルド時にその内容が `.build/output` ディレクトリにコピーされます。

## サーバーの起動 \{#running-the-server\}

HTTP サーバーを起動します：

```bash copy
node .mastra/output/index.mjs
```

## テレメトリーを有効にする \{#enable-telemetry\}

テレメトリーとオブザーバビリティを有効にするには、instrumentation ファイルを読み込みます。

```bash copy
node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
```
