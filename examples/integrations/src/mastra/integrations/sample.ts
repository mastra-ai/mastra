import { createSync, createTool, MIntegration, Step, ToolApi, Workflow } from "@mastra/core";
import { z } from "zod";

const step = new Step({
    id: 'test-one',
    action: async (props) => {
        console.log(props)
        return {
            message: 'Hello World'
        }
    },
    inputSchema: z.object({
        name: z.string()
    }),
    outputSchema: z.object({
        message: z.string()
    })
})

const workflow = new Workflow({
    name: 'test',
    triggerSchema: z.object({
        name: z.string(),
    })
})

workflow.then(step)

export class SampleIntegration extends MIntegration {
    constructor() {
        super();

        this.registerSync('SAMPLE_SYNC', createSync({
            executor: async (props) => {
                console.log(props)
                return {
                    message: 'Hello World'
                }
            },
            label: 'Sample Sync',
            description: 'Sample Sync Description',
            schema: z.object({}),
            outputShema: z.object({
                message: z.string()
            })
        }))


        this.registerWorkflow('SAMPLE_WORKFLOW', workflow)
    }

    getStaticTools() {
        return {
            SAMPLE_TOOL: createTool({
                executor: async (props) => {
                    console.log(props)
                    return {
                        message: 'Hello World'
                    }
                },
                label: 'Sample Tool',
                description: 'Sample Tool Description',
                schema: z.object({}),
                outputSchema: z.object({
                    message: z.string()
                })
            })
        }
    }

    async getTools(_params: void) {
        return {
            SOME_OTHER_TOOL: createTool({
                executor: async (props) => {
                    console.log(props)
                    return {
                        message: 'Hello World'
                    }
                },
                label: 'Some Other Tool',
                description: 'Some Other Tool Description',
                schema: z.object({}),
                outputSchema: z.object({
                    message: z.string()
                })
            })
        }
    }
}