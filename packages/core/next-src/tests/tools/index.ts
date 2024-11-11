import { z } from "zod";
import { createTool } from "../..";

export const testTool = createTool({
    label: 'Test Tool',
    schema: z.object({}),
    description: `This is a test tool`,
    executor: async ({ data }) => {
        return data;
    }
})