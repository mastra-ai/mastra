import { VectorDB } from '../dist';

import { expect } from 'chai';

describe('VectorDB', () => {
    const db = new VectorDB();
    const queryVector = Array(100).fill(0).map((_, i) => i)

    it('add 3 documents', async () => {
        db.add({
            id: "1",
            embedding: Array(100).fill(0).map(() => Math.random() * 100),
            metadata: {
                text: "first"
            }
        })

        db.add({
            id: "2",
            embedding: queryVector,
            metadata: {
                text: "second"
            }
        })
 
        db.add({
            id: "3",
            embedding: Array(100).fill(0).map(() => Math.random() * 100),
            metadata: {
                text: "third"
            }
        })
 
        expect(db.size()).to.equal(3)
    });

    it('should return the second document', async () => {
        const searchResults = await db.query(queryVector, 2);

        expect(searchResults.length).to.equal(2);
        expect(searchResults[0].similarity).greaterThanOrEqual(1);
        expect(searchResults[0].document.id).to.equal("2");
        expect(searchResults[0].document.metadata.text).to.equal("second");
    });

    it('terminate worker to finish test', async () => {
        await db.terminate();
    });
});