import { z } from 'zod'
import { orderBy } from 'lodash'
import { createAssistantAgent, getAssistantAgent } from "./assistant"


async function getSportsNews() {
    const URI = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=10000`
    const response = await fetch(URI)
    const data = await response.json()
    return data
}

describe('Agent core', () => {
    it.only('Does shit', async () => {

        // const newAssistant = await createAssistantAgent({
        //     name: `NFL Sports Analyst`,
        //     instructions: `You are a sports analyst.`,
        //     model: 'gpt-4o',
        //     tools: [
        //         {
        //             type: "function",
        //             function: {
        //                 name: "getSportsNews",
        //                 description: "Get current sports news",
        //                 parameters: {},
        //             },
        //         },
        //     ]
        // })

        const assistant_id = `asst_mFswl3bmGEsWJJxPMaT5mthN`

        const assistant = await getAssistantAgent({ id: assistant_id, toolMap: {
            getSportsNews
        } })

        console.log(assistant)

        // const thread = await assistant.initializeThread([{
        //     role: "user",
        //     content: "What is the latest news in NFL news",
        // }])

        // console.log(thread)

        const threadId = `thread_L9JaFXCVmWMsTu9SCqpdwS4Q`

        await assistant.createUserMessage({
            threadId,
            content: "Who had the big reception on Patrick Mahomes?",
        })

        const run = await assistant.watchRun({ threadId })

        console.log(JSON.stringify(run, null, 2))

    }, 10000000)
})