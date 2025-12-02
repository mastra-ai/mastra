<div align="center">
  <h1><a href="https://www.npmjs.com/package/fastembed">FastEmbed-js ⚡️</a></h1>
  <h3>Typescript/NodeJS implementation of <a href="https://github.com/qdrant/fastembed" target="_blank">@Qdrant/fastembed</a></h3>
  <a href="https://www.npmjs.com/package/fastembed"><img src="https://img.shields.io/npm/v/fastembed.svg" alt="Crates.io"></a>
  <a href="https://github.com/Anush008/fastembed-js/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-mit-blue.svg" alt="MIT Licensed"></a>
  <a href="https://github.com/Anush008/fastembed-js/actions/workflows/release.yml"><img src="https://github.com/Anush008/fastembed-js/actions/workflows/release.yml/badge.svg?branch=main" alt="Semantic release"></a>
</div>

## 🍕 Features
* Supports CommonJS and ESM.
* Uses [@anush008/tokenizers](https://github.com/Anush008/tokenizers) multi-arch native bindings for [@huggingface/tokenizers](https://github.com/huggingface/tokenizers).
* Supports batch embedddings with generators.

The default model is Flag Embedding, which is top of the [MTEB](https://huggingface.co/spaces/mteb/leaderboard) leaderboard.

## 🔍 Not looking for Javascript?

- Python 🐍: [fastembed](https://github.com/qdrant/fastembed)
- Rust 🦀: [fastembed-rs](https://github.com/Anush008/fastembed-rs)
- Go 🐳: [fastembed-go](https://github.com/Anush008/fastembed-go)

## 🤖 Models

- [**BAAI/bge-base-en**](https://huggingface.co/BAAI/bge-base-en)
- [**BAAI/bge-base-en-v1.5**](https://huggingface.co/BAAI/bge-base-en-v1.5)
- [**BAAI/bge-small-en**](https://huggingface.co/BAAI/bge-small-en)
- [**BAAI/bge-small-en-v1.5**](https://huggingface.co/BAAI/bge-small-en-v1.5) - Default
- [**BAAI/bge-base-zh-v1.5**](https://huggingface.co/BAAI/bge-base-zh-v1.5)
- [**sentence-transformers/all-MiniLM-L6-v2**](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [**intfloat/multilingual-e5-large**](https://huggingface.co/intfloat/multilingual-e5-large)


## 🚀 Installation

To install the FastEmbed library, npm works: 

```bash
npm install fastembed
```

## 📖 Usage

```js
import { EmbeddingModel, FlagEmbedding } from "fastembed";
// For CommonJS
// const { EmbeddingModel, FlagEmbedding } = require("fastembed)

const embeddingModel = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN
});

let documents = [
    "passage: Hello, World!",
    "query: Hello, World!",
    "passage: This is an example passage.",
    // You can leave out the prefix but it's recommended
    "fastembed-js is licensed under MIT" 
];

const embeddings = embeddingModel.embed(documents, 2); //Optional batch size. Defaults to 256

for await (const batch of embeddings) {
    // batch is list of Float32 embeddings(number[][]) with length 2
    console.log(batch);
}

```

#### Supports passage and query embeddings for more accurate results
```ts
const embeddings = embeddingModel.passageEmbed(listOfLongTexts, 10); //Optional batch size. Defaults to 256

for await (const batch of embeddings) {
    // batch is list of Float32 passage embeddings(number[][]) with length 10
    console.log(batch);
}

const queryEmbeddings: number[] = await embeddingModel.queryEmbed(userQuery);
console.log(queryEmbeddings)

```

## 🚒 Under the hood

### Why fast?

It's important we justify the "fast" in FastEmbed. FastEmbed is fast because:

1. Quantized model weights
2. ONNX Runtime which allows for inference on CPU, GPU, and other dedicated runtimes

### Why light?
1. No hidden dependencies via Huggingface Transformers

### Why accurate?
1. Better than OpenAI Ada-002
2. Top of the Embedding leaderboards e.g. [MTEB](https://huggingface.co/spaces/mteb/leaderboard)

## © LICENSE

MIT © [2023](https://github.com/Anush008/fastembed-js/blob/main/LICENSE)
