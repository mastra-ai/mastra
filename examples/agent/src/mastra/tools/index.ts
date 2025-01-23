import { createTool } from '@mastra/core';

export const myTool = createTool({
    id: 'my-tool',
    description: 'My tool description',
    execute: async () => {
        console.log('My tool is running!');
    },
})