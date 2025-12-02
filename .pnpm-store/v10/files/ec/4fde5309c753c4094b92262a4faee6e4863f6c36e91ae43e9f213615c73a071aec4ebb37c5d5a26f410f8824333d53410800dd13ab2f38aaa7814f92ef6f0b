"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDB = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const worker_threads_1 = require("worker_threads");
const openai_1 = require("./openai");
const worker_1 = __importDefault(require("./worker"));
class VectorDB {
    constructor() {
        this.worker = new worker_threads_1.Worker(worker_1.default.cosineSimilarity, { eval: true });
        this.requests = new Map();
        this.documents = new Map();
        this.worker.on('message', (data) => {
            const { id, results } = data;
            const { resolve } = this.requests.get(id) || {};
            if (resolve) {
                resolve(results);
                this.requests.delete(id);
            }
        });
    }
    addText(text) {
        return __awaiter(this, void 0, void 0, function* () {
            const embedding = yield (0, openai_1.createEmbedding)(text);
            const id = (Math.floor(Math.random() * 10000) + 1).toString();
            this.documents.set(id, {
                id: id,
                embedding: embedding,
                metadata: {
                    text: text
                }
            });
            return this.documents.get(id);
        });
    }
    add(document) {
        this.documents.set(document.id, document);
        return this.documents.get(document.id);
    }
    get(id) {
        return this.documents.get(id);
    }
    del(document) {
        this.documents.delete(document.id);
    }
    size() {
        return this.documents.size;
    }
    loadFile(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: handle exceptions
            const dataBuffer = yield promises_1.default.readFile(filename);
            const documents = JSON.parse(dataBuffer.toString());
            for (let doc of documents) {
                this.add(doc);
            }
        });
    }
    dumpFile(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: handle exceptions
            const jsonDump = JSON.stringify([...this.documents.values()]);
            yield promises_1.default.writeFile(filename, jsonDump);
        });
    }
    query(queryVector, top_k = 10) {
        const documents = this.documents;
        return new Promise((resolve) => {
            const id = (Math.floor(Math.random() * 10000) + 1);
            this.requests.set(id, { resolve });
            this.worker.postMessage({ id, queryVector, documents, top_k });
        });
    }
    queryText(text, top_k = 10) {
        return __awaiter(this, void 0, void 0, function* () {
            const embedding = yield (0, openai_1.createEmbedding)(text);
            return this.query(embedding, top_k);
        });
    }
    terminate() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.worker.terminate();
        });
    }
}
exports.VectorDB = VectorDB;
