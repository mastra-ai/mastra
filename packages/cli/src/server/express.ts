import { Mastra } from '@mastra/core'
import express, { Request, Response } from 'express'

export function createExpressServe({ mastra, port }: { port: number, mastra: Mastra<any, any, any> }) {
    const app = express()
    
    app.post('/agent/:agent_id/text', async (req: Request, res: Response) => {
        const agent = mastra.getAgent(req.params.agent_id)

        const text = await agent.text({
            messages: req.body.messages,
            maxSteps: req.body.maxSteps,
        })
        res.json(text);
    })

    app.listen(port, () => {
        console.log(`Server running at :${port}`)
    })

}