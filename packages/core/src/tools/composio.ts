import { Composio } from "composio-core"
import { jsonSchemaToModel } from "composio-core/lib/src/utils/shared";
import { z } from "zod";
import { createTool } from "./create-tool";

type Optional<T> = T | null;

const zExecuteToolCallParams = z.object({
    actions: z.array(z.string()).optional(),
    apps: z.array(z.string()).optional(),
    params: z.record(z.any()).optional(),
    entityId: z.string().optional(),
    useCase: z.string().optional(),
    usecaseLimit: z.number().optional(),
    connectedAccountId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    filterByAvailableApps: z.boolean().optional().default(false),
});

export class MastraComposToolset {
    client: Composio
    entityId?: string | null
    connectedAccountId?: string | null
    constructor(
        {
            apiKey,
            baseUrl,
            entityId,
            connectedAccountId,
        }: {
            apiKey: string;
            baseUrl?: string;
            entityId?: string;
            connectedAccountId?: string;
        }
    ) {
        this.connectedAccountId = connectedAccountId;
        this.entityId = entityId;
        this.client = new Composio(apiKey, baseUrl, "mastra-ai");
    }

    private generateTool(schema: Record<string, any>) {
        console.log(schema.name, schema.parameters)
        const parameters = jsonSchemaToModel(schema.parameters);

        return createTool({
            label: schema.description,
            description: schema.description,
            schema: parameters,
            executor: async ({ data }) => {
                try {

                    const d = await this.client.getEntity(this.entityId!).execute(schema.name,
                        data || {},
                        undefined,
                        this.connectedAccountId!
                    )
                    console.log(d)
                    return d
                } catch (e) {
                    console.log(e)
                    return {}
                }
            },
        });
    }

    async getTools(filters: {
        actions?: Array<string>;
        apps?: Array<string>;
        tags?: Optional<Array<string>>;
        useCase?: Optional<string>;
        usecaseLimit?: Optional<number>;
        filterByAvailableApps?: Optional<boolean>;
    }): Promise<{ [key: string]: any }> {
        const {
            apps,
            tags,
            useCase,
            usecaseLimit,
            // filterByAvailableApps,
            actions,
        } = zExecuteToolCallParams.parse(filters);

        const actionsList = await this.client.actions.list({
            ...(apps && { apps: apps?.join(",") }),
            ...(tags && { tags: tags?.join(",") }),
            ...(useCase && { useCase: useCase }),
            ...(actions && { actions: actions?.join(",") }),
            ...(usecaseLimit && { usecaseLimit: usecaseLimit }),
            filterByAvailableApps: true,
        });

        const tools = {};
        actionsList.items?.forEach((actionSchema) => {
            // @ts-ignore
            tools[actionSchema.name!] = this.generateTool(actionSchema);
        });

        return tools;
    }
}