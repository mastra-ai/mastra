import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

import { VectorDB } from '../dist'
import { createEmbedding } from './openai'

async function main() {
    console.log("Sample DB loading...")
    const db = new VectorDB();
    await db.loadFile('db.json')

    const rl = readline.createInterface({ input, output })

    while (true) {
        const text = await rl.question('\nSearch text: ')
        if (!text) { break }

        const queryVector = await createEmbedding(text)
        const searchResults = await db.query(queryVector, 3)

        for (let { similarity, document } of searchResults) {
            console.log('---')
            console.log(`similarity: ${similarity}`)
            console.log(`text: ${document.metadata.text}`)
        }
    }

    db.terminate();
    rl.close();
}

main()