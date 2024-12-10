
import { Agent, Mastra } from '@mastra/core';

export function createMastra(tools) {
    const agent = new Agent({
        name: 'Notion agent',
        model: {
            name: "gpt-4o-mini",
            provider: "OPEN_AI",
        },
        instructions: `
        You are a Notion knowledge base librarian.

        You can search for notion pages with the tool NOTION_SEARCH_NOTION_PAGE. 
        The user input will be in the query parameter.
        `,
        enabledTools: {
            NOTION_GET_ABOUT_ME: true,
            NOTION_SEARCH_NOTION_PAGE: true,
        }
    })

    return new Mastra({
        tools,
        agents: [agent]
    })
}