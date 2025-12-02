import fs from 'fs/promises'
import { Worker } from 'worker_threads';
import { Embedding, Document, Documents, WorkerData, WorkerResult, Requests } from './types';
import { createEmbedding } from './openai';

import worker from './worker';

class VectorDB {
    private worker: Worker;
    private requests: Requests;
    private documents: Documents;

    constructor() {
        this.worker = new Worker(worker.cosineSimilarity, { eval: true });
        this.requests = new Map();
        this.documents = new Map();

        this.worker.on('message', (data: WorkerResult) => {
            const { id, results } = data;
            const { resolve } = this.requests.get(id) || {};
            if (resolve) {
                resolve(results);
                this.requests.delete(id);
            }
        });
    }

    async addText(text: string): Promise<Document | undefined> {
        const embedding = await createEmbedding(text)
        const id = (Math.floor(Math.random() * 10000) + 1).toString()
        this.documents.set(id, {
            id: id,
            embedding: embedding,
            metadata: {
                text: text
            }
        });

        return this.documents.get(id)
    }

    add(document: Document): Document | undefined {
        this.documents.set(document.id, document);
        return this.documents.get(document.id)
    }

    get(id: string): Document | undefined {
        return this.documents.get(id);
    }

    del(document: Document): void {
        this.documents.delete(document.id);
    }

    size(): number {
        return this.documents.size;
    }

    async loadFile(filename: string) {
        // TODO: handle exceptions
        const dataBuffer = await fs.readFile(filename)
        const documents = JSON.parse(dataBuffer.toString())

        for (let doc of documents) {
            this.add(doc)
        }
    }

    async dumpFile(filename: string) {
        // TODO: handle exceptions
        const jsonDump = JSON.stringify([...this.documents.values()])
        await fs.writeFile(filename, jsonDump)
    }

    query(queryVector: Embedding, top_k: number=10): Promise<any> {
        const documents = this.documents;

        return new Promise((resolve) => {
            const id = (Math.floor(Math.random() * 10000) + 1);
            this.requests.set(id, { resolve });
            this.worker.postMessage({ id, queryVector, documents, top_k } as WorkerData);
        });
    }

    async queryText(text: string, top_k: number=10): Promise<any> {
        const embedding = await createEmbedding(text)
        return this.query(embedding, top_k)
    }

    async terminate() {
        await this.worker.terminate();
    }
}

export {
    Embedding,
    Document,
    VectorDB,
};