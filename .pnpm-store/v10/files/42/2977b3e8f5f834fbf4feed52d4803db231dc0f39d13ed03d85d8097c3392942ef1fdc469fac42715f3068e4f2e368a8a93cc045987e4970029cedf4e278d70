type Embedding = number[];

type Document = {
    id: string;
    embedding: Embedding;
    metadata: { [key: string]: any };
}

type Documents = Map<string, Document>;

type WorkerData = {
    id: number;
    queryVector: Embedding;
    documents: Documents;
    top_k: number;
}

type WorkerResult = {
    id: number;
    results: {
        index: number,
        similarity: number,
        document: Document
    }[];
}

type ResolveFunction = (value: unknown) => void;

type Request = {
    resolve: ResolveFunction;
};

type Requests = Map<number, Request>

export { Embedding, Document, Documents, WorkerData, WorkerResult, Request, Requests };