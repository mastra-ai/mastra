import { VectorDB } from '../dist'

async function main() {
    const db = new VectorDB();

    console.log("Sample DB generating...")

    await db.addText("안녕하세요?")
    await db.addText("안녕?")
    await db.addText("Hello?")
    await db.addText("뭐하니?")
    await db.addText("오늘 날씨 어때?")

    const searchResults = await db.queryText("hi?", 3)

    console.log("\nquery: hi?")
    console.log(`# of results: ${searchResults.length}`)
    console.log(`the 1st result: ${searchResults[0].document.metadata.text}\n`)

    db.terminate();
}

main()