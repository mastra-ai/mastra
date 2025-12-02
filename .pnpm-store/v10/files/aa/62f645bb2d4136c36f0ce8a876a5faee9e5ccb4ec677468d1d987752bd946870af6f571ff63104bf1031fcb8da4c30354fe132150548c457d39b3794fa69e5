# In-memory VectorDB

Super simple in-memory vector DB for Node.js

You can use this to make prototypes or small products in Node.js fast.

## Installation

```sh
npm install imvectordb
```

## Usage

Please check "samples" folder and types.

```typescript
import { VectorDB } from 'imvectordb';

const db = new VectorDB();

// Add a document
db.add({
    id: "1",
    embedding: [0.014970540, ...],
    metadata: {
        text: "original text",
        ... // anything
    }
})

// Search documents, top_k=10
const queryVector = [0.014970540, ...]
const searchResults = await db.query(queryVector, 10)

searchResults[0].similarity
searchResults[0].document.id
searchResults[0].document.embedding
searchResults[0].document.metadata.text

// You can also use like this to make prototypes super simple.
// It use OpenAI's "text-embedding-ada-002" model to embed automatically
// So you need to set "OPENAI_API_KEY" environment value
db.addText("add vector with only text")
db.queryText("search text here", 3)

// Get, Delete a document
db.get("1")
db.del("1")

// Dump and Load from file
db.dumpFile("filename.json")
db.loadFile("filename.json")

// Make sure to terminate the Worker when the server is closed or no longer needed.
db.terminate()
```

## Performance

Use up to 10,000 documents; going over is not recommended. A few thousand is ideal.

There's significant room for performance improvement. Patches and PRs are welcome.

```
CPU: Apple M2
Memory: 25769803776

----------
Search in 100 documents, 10 times.
----------
Total: 57.577ms
Average: 5.758ms

----------
Search in 1000 documents, 10 times.
----------
Total: 541.979ms
Average: 54.198ms

----------
Search in 10000 documents, 10 times.
----------
Total: 13430.621ms
Average: 1343.062ms
```

## License

MIT