import os from 'os'

import { VectorDB } from '../dist'

const randomVector: () => number[]
    = () =>
    Array(1536).fill(0).map(() => Math.random() * 100)

const performanceLog = (
    title: string,
    startTime: number,
    endTime: number,
    count: number
) => {
    const elapsedTime = endTime - startTime

    console.log(`\n----------`)
    console.log(title)
    console.log(`----------`)
    console.log(`Total: ${elapsedTime.toFixed(3)}ms`)
    console.log(`Average: ${(elapsedTime / count).toFixed(3)}ms`)
}

const searchTest = async (totalDocuments: number) => {
    const db = new VectorDB()

    for (let i = 0; i < totalDocuments; i++) {
        db.add({
            id: i.toString(),
            embedding: randomVector(),
            metadata: {
                text: "We don't make mistakes, we have happy accidents."
            }
        })
    }

    let startTime = performance.now();
    const queryVector = randomVector()
    for (let i = 0; i < 10; i++) {
        await db.query(queryVector, 10)
    }
    performanceLog(`Search in ${totalDocuments} documents, 10 times.`,
        startTime, performance.now(), 10)

    db.terminate()
}

async function main() {
    console.log(`CPU: ${os.cpus()[0].model}`);
    console.log(`Memory: ${os.totalmem()}`);

    await searchTest(100)
    await searchTest(1000)
    await searchTest(10000)
}

main()