import fs from 'fs'
import { VectorDB } from '../dist'
import { createEmbedding } from './openai'

async function createSampleDb(filename: string) {
    const db = new VectorDB()
    const dataBuffer = fs.readFileSync(filename)
    const documents = JSON.parse(dataBuffer.toString())

    console.log("Sample DB creating...\n")
    for (let doc of documents) {
        console.log(`${doc.id}: ${doc.text}`)
        let embedding = await createEmbedding(doc.text)

        db.add({
            id: doc.id,
            embedding: embedding,
            metadata: {
                text: doc.text
            }
        })
    }

    return db
}

async function main() {
    const db = await createSampleDb('documents.json')

    console.log(`\nNumber of documents: ${db.size()}`)

    await db.dumpFile('db.json')

    db.terminate();
}

main()