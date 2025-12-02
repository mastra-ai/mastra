import { Embedding } from './types'
import OpenAI from "openai"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

async function createEmbedding(text: string): Promise<Embedding> {
    try {
        const response = await openai.embeddings.create({
            input: text,
            model: 'text-embedding-ada-002',
        })

        return response['data'][0]['embedding'];
    } catch (error) {
        throw error;
    }
}

export { createEmbedding }