// TODO: Improve the code into a file and import the file.
// I tried to use import.meta.url but TypeScript is.. sucks in this case. :-(
const worker = {
    cosineSimilarity: `const { parentPort } = require('worker_threads');

parentPort?.on('message', (data) => {
    const { id, queryVector, documents, top_k } = data;
    const results = new Array()

    const cosineSimilarity = (A, B ) => {
        let dotproduct = 0;
        let mA = 0;
        let mB = 0;
    
        for(let i = 0; i < A.length; i++) {
            dotproduct += A[i] * B[i];
            mA += A[i] * A[i];
            mB += B[i] * B[i];
        }
    
        mA = Math.sqrt(mA);
        mB = Math.sqrt(mB);
    
        return dotproduct / (mA * mB);
    }

    for (let doc of documents) {
        results.push({
            similarity: cosineSimilarity(queryVector, doc[1].embedding),
            document: doc[1] 
        })
    }

    results.sort((a, b) => b.similarity - a.similarity);

    parentPort?.postMessage({ id, results: results.slice(0, top_k) });
});`
}

export default worker