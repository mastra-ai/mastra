import { z } from 'zod';

export const helloInputSchema = z.object({
  name: z.string().optional().describe('Optional name to greet. If not provided, will use a default greeting.'),
});

export type HelloInput = z.infer<typeof helloInputSchema>;

export const helloTool = {
  description:
    'This is a tool from the registry-registry MCP server.\nGet a greeting from the registry-registry service. You can provide an optional name to personalize the greeting.',

  async execute(args: HelloInput) {
    const name = args.name || 'World';

    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${name}! Welcome to the Registry Registry service.`,
        },
      ],
    };
  },
};
