import { Agent } from '@mastra/core';

import { MastraMCPClient } from './client.js';

const everArtClient = new MastraMCPClient({
    name: 'everart',
    server: {
        command: '/usr/local/bin/docker',
        args: ['run', '-i', '--rm', '--network=host', '-e', 'EVERART_API_KEY', 'mcp/everart'],
        env: {
            EVERART_API_KEY: process.env.EVERART_API_KEY!,
        },
    },
});

const agent = new Agent({
    name: 'everart',
    instructions: 'You are my artist. Include the url in your response.',
    model: {
        provider: 'ANTHROPIC',
        name: 'claude-3-5-sonnet-20241022',
        toolChoice: 'auto',
    },
});

describe.skip('MastraMCPClient', () => {
    beforeAll(async () => {
        await everArtClient.connect();
    });

    afterAll(async () => {
        await everArtClient.disconnect();
    });

    it('Converting tools into Mastra', async () => {
        const list = await everArtClient.resources();

        expect(list.resources.length).toBeGreaterThan(0);

        // The MCP server tools are now available to your Mastra Agents
        const tools = await everArtClient.tools();

        const response = await agent.generate('Can you make me a picture of a dog?', {
            toolsets: {
                everart: tools,
            },
        });

        console.log(response.text);

        expect(Object.keys(tools).length).toBeGreaterThan(0);
    }, 50000);
});