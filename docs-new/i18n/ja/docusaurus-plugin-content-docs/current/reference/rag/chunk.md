---
title: '.chunk() '
description: Mastra の chunk 関数に関するドキュメント。さまざまな手法を用いてドキュメントを小さな単位に分割します。
---

# リファレンス: .chunk() \{#reference-chunk\}

`.chunk()` 関数は、さまざまな戦略やオプションを使ってドキュメントを小さなセグメントに分割します。

## 例 \{#example\}

```typescript
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromMarkdown(`
# はじめに
これはチャンクに分割するサンプルドキュメントです。

## セクション1
いくつかのコンテンツを含む最初のセクションです。

## セクション2
異なるコンテンツを含む別のセクションです。
`);

// デフォルト設定による基本的なチャンク分割
const chunks = await doc.chunk();

// ヘッダー抽出を含むMarkdown固有のチャンク分割
const chunksWithMetadata = await doc.chunk({
  strategy: 'markdown',
  headers: [
    ['#', 'title'],
    ['##', 'section'],
  ],
  extract: {
    summary: true, // デフォルト設定で要約を抽出
    keywords: true, // デフォルト設定でキーワードを抽出
  },
});
```

## パラメータ \{#parameters\}

以下のパラメータは、すべてのチャンク分割戦略で使用できます。
**重要:** 各戦略は、そのユースケースに関連する一部のパラメータのみを利用します。

<PropertiesTable
  content={[
{
name: "strategy",
type: "'recursive' | 'character' | 'token' | 'markdown' | 'semantic-markdown' | 'html' | 'json' | 'latex' | 'sentence'",
isOptional: true,
description:
"使用するチャンク分割戦略。未指定の場合はドキュメント種別に基づくデフォルトが適用されます。戦略によっては追加のオプションがあります。デフォルト: .md ファイル → 'markdown'、.html/.htm → 'html'、.json → 'json'、.tex → 'latex'、その他 → 'recursive'",
},
{
name: "maxSize",
type: "number",
isOptional: true,
defaultValue: "4000",
description: "各チャンクの最大サイズ。**注:** 一部の戦略設定（ヘッダー付きの Markdown、ヘッダー付きの HTML）ではこのパラメータは無視されます。",
},
{
name: "size",
type: "number",
isOptional: true,
description: "**非推奨:** 代わりに `maxSize` を使用してください。このパラメータは次回のメジャーバージョンで削除されます。",
},
{
name: "overlap",
type: "number",
isOptional: true,
defaultValue: "50",
description: "チャンク間で重複させる文字数/トークン数。",
},
{
name: "lengthFunction",
type: "(text: string) => number",
isOptional: true,
description: "テキスト長を算出する関数。デフォルトは文字数です。",
},
{
name: "keepSeparator",
type: "boolean | 'start' | 'end'",
isOptional: true,
description:
"セパレーターをチャンクの先頭または末尾に保持するかどうか。",
},
{
name: "addStartIndex",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "チャンクに開始インデックスのメタデータを付与するかどうか。",
},
{
name: "stripWhitespace",
type: "boolean",
isOptional: true,
defaultValue: "true",
description: "チャンクから空白を除去するかどうか。",
},
{
name: "extract",
type: "ExtractParams",
isOptional: true,
description:
"メタデータ抽出の設定。",
},
]}
/>

`extract` パラメータの詳細は [ExtractParams リファレンス](/docs/reference/rag/extract-params)をご覧ください。

## 戦略固有のオプション \{#strategy-specific-options\}

戦略固有のオプションは、strategy パラメータと同様にトップレベルのパラメータとして渡されます。例：

```typescript showLineNumbers copy
// 文字戦略の例
const chunks = await doc.chunk({
  strategy: 'character',
  separator: '.', // 文字戦略固有のオプション
  isSeparatorRegex: false, // 文字戦略固有のオプション
  maxSize: 300, // 共通オプション
});

// 再帰戦略の例
const chunks = await doc.chunk({
  strategy: 'recursive',
  separators: ['\n\n', '\n', ' '], // 再帰戦略固有のオプション
  language: 'markdown', // 再帰戦略固有のオプション
  maxSize: 500, // 共通オプション
});

// 文戦略の例
const chunks = await doc.chunk({
  strategy: 'sentence',
  maxSize: 450, // 文戦略で必須
  minSize: 50, // 文戦略固有のオプション
  sentenceEnders: ['.'], // 文戦略固有のオプション
  fallbackToCharacters: false, // 文戦略固有のオプション
  keepSeparator: true, // 共通オプション
});

// HTML戦略の例
const chunks = await doc.chunk({
  strategy: 'html',
  headers: [
    ['h1', 'title'],
    ['h2', 'subtitle'],
  ], // HTML戦略固有のオプション
});

// Markdown戦略の例
const chunks = await doc.chunk({
  strategy: 'markdown',
  headers: [
    ['#', 'title'],
    ['##', 'section'],
  ], // Markdown戦略固有のオプション
  stripHeaders: true, // Markdown戦略固有のオプション
});

// セマンティックMarkdown戦略の例
const chunks = await doc.chunk({
  strategy: 'semantic-markdown',
  joinThreshold: 500, // セマンティックMarkdown戦略固有のオプション
  modelName: 'gpt-3.5-turbo', // セマンティックMarkdown戦略固有のオプション
});

// トークン戦略の例
const chunks = await doc.chunk({
  strategy: 'token',
  encodingName: 'gpt2', // トークン戦略固有のオプション
  modelName: 'gpt-3.5-turbo', // トークン戦略固有のオプション
  maxSize: 1000, // 共通オプション
});
```

以下に記載のオプションは、別の options オブジェクトにネストするのではなく、設定オブジェクトのトップレベルで直接指定します。

### 文字列 \{#character\}

<PropertiesTable
  content={[
{
name: "separators",
type: "string[]",
isOptional: true,
description: "優先度の高い順に試す区切り文字の配列。最初の区切り文字での分割を試み、できなければ次の候補に切り替えます。",
},
{
name: "isSeparatorRegex",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "区切り文字が正規表現パターンかどうか",
},
]}
/>

### 再帰的 \{#recursive\}

<PropertiesTable
  content={[
{
name: "separators",
type: "string[]",
isOptional: true,
description: "優先度順に試す区切りの配列。まず最初の区切りで分割を試し、できなければ次以降にフォールバックします。",
},
{
name: "isSeparatorRegex",
type: "boolean",
isOptional: true,
defaultValue: "false",
description: "区切りが正規表現パターンかどうか",
},
{
name: "language",
type: "Language",
isOptional: true,
description: "言語特有の分割挙動に用いるプログラミング言語またはマークアップ言語。対応する値は Language 列挙型を参照してください。",
},
]}
/>

### 文 \{#sentence\}

<PropertiesTable
  content={[
{
name: "maxSize",
type: "number",
description: "各チャンクの最大サイズ（sentence 戦略で必須）",
},
{
name: "minSize",
type: "number",
isOptional: true,
defaultValue: "50",
description: "各チャンクの最小サイズ。これより小さいチャンクは、可能であれば隣接するチャンクと結合されます。",
},
{
name: "targetSize",
type: "number",
isOptional: true,
description: "チャンクの推奨目標サイズ。既定は maxSize の 80%。この戦略はこのサイズに近いチャンクの作成を試みます。",
},
{
name: "sentenceEnders",
type: "string[]",
isOptional: true,
defaultValue: "['.', '!', '?']",
description: "分割境界として扱う文末記号の配列。",
},
{
name: "fallbackToWords",
type: "boolean",
isOptional: true,
defaultValue: "true",
description: "maxSize を超える文に対して、単語レベルでの分割にフォールバックするかどうか。",
},
{
name: "fallbackToCharacters",
type: "boolean",
isOptional: true,
defaultValue: "true",
description: "maxSize を超える単語に対して、文字レベルでの分割にフォールバックするかどうか。fallbackToWords が有効な場合にのみ適用されます。",
},
]}
/>

### HTML \{#html\}

<PropertiesTable
  content={[
{
name: "headers",
type: "Array<[string, string]>",
description:
"ヘッダー分割用の [selector, metadata key] の組（ペア）の配列",
},
{
name: "sections",
type: "Array<[string, string]>",
description:
"セクション分割用の [selector, metadata key] の組（ペア）の配列",
},
{
name: "returnEachLine",
type: "boolean",
isOptional: true,
description: "各行を個別のチャンクとして返すかどうか",
},
]}
/>

**重要:** HTML ストラテジーを使用する場合、一般オプションはすべて無視されます。ヘッダー分割には `headers`、セクション分割には `sections` を使用してください。両方を指定した場合は `sections` が無視されます。

### Markdown \{#markdown\}

<PropertiesTable
  content={[
{
name: "headers",
type: "Array<[string, string]>",
isOptional: true,
description: "［見出しレベル、メタデータキー］のペア配列",
},
{
name: "stripHeaders",
type: "boolean",
isOptional: true,
description: "出力から見出しを削除するかどうか",
},
{
name: "returnEachLine",
type: "boolean",
isOptional: true,
description: "各行を個別のチャンクとして返すかどうか",
},
]}
/>

**重要:** `headers` オプションを使用すると、Markdown 戦略はすべての一般オプションを無視し、コンテンツは Markdown の見出し構造に基づいて分割されます。Markdown でサイズベースのチャンク分割を行うには、`headers` パラメータを省略してください。

### セマンティックMarkdown \{#semantic-markdown\}

<PropertiesTable
  content={[
{
name: "joinThreshold",
type: "number",
isOptional: true,
defaultValue: "500",
description: "関連セクションを結合する際の最大トークン数。単体でこの上限を超えるセクションはそのまま残し、より小さなセクションは合計サイズがこのしきい値以内であれば同階層や親セクションと結合します。",
},
{
name: "modelName",
type: "string",
isOptional: true,
description: "トークン化に使用するモデル名。指定がある場合は、そのモデルの基盤となるトークン化方式の `encodingName` が使用されます。",
},
{
name: "encodingName",
type: "string",
isOptional: true,
defaultValue: "cl100k_base",
description: "使用するトークンエンコーディング名。指定された `modelName` から導出される場合があります。",
},
{
name: "allowedSpecial",
type: "Set<string> | 'all'",
isOptional: true,
description: "トークン化時に許可する特殊トークンの集合。すべての特殊トークンを許可する場合は 'all' を指定します。",
},
{
name: "disallowedSpecial",
type: "Set<string> | 'all'",
isOptional: true,
defaultValue: "all",
description: "トークン化時に禁止する特殊トークンの集合。すべての特殊トークンを禁止する場合は 'all' を指定します。",
},
]}
/>

### トークン \{#token\}

<PropertiesTable
  content={[
{
name: "encodingName",
type: "string",
isOptional: true,
description: "使用するトークンエンコーディングの名称",
},
{
name: "modelName",
type: "string",
isOptional: true,
description: "トークナイズに用いるモデルの名称",
},
{
name: "allowedSpecial",
type: "Set<string> | 'all'",
isOptional: true,
description: "トークナイズ時に許可する特殊トークンの集合。すべての特殊トークンを許可する場合は 'all'",
},
{
name: "disallowedSpecial",
type: "Set<string> | 'all'",
isOptional: true,
description: "トークナイズ時に禁止する特殊トークンの集合。すべての特殊トークンを禁止する場合は 'all'",
},
]}
/>

### JSON \{#json\}

<PropertiesTable
  content={[
{
name: "maxSize",
type: "number",
description: "各チャンクの最大サイズ",
},
{
name: "minSize",
type: "number",
isOptional: true,
description: "各チャンクの最小サイズ",
},
{
name: "ensureAscii",
type: "boolean",
isOptional: true,
description: "ASCII エンコードを強制するかどうか",
},
{
name: "convertLists",
type: "boolean",
isOptional: true,
description: "JSON 内のリストを変換するかどうか",
},
]}
/>

### LaTeX \{#latex\}

LaTeX 戦略は、上記の一般的なチャンク化オプションのみを使用します。数学および学術向け文書に最適化された、LaTeX に配慮した分割を提供します。

## 返り値 \{#return-value\}

チャンク化されたドキュメントを含む `MDocument` インスタンスを返します。各チャンクには次の内容が含まれます：

```typescript
interface DocumentNode {
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}
```
