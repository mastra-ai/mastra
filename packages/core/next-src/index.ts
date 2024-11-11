import { z, ZodSchema } from 'zod';

export interface IntegrationApiExcutorParams<
    T extends Record<string, any> = Record<string, any>
> {
    data: T;
}

export type ToolApi<
    IN extends Record<string, any> = Record<string, any>,
    OUT extends Record<string, any> = Record<string, any>
> = {
    // integrationName: string;
    schema:
    | ZodSchema<IN>
    // | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<IN>>);
    //   outputSchema?:
    //     | ZodSchema
    //     | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<OUT>>);
    //   type: string;
    label: string;
    //   getSchemaOptions?: ({
    //     ctx,
    //   }: {
    //     ctx: IntegrationContext;
    //   }) => Promise<Record<string, SchemaFieldOptions>>;
    //   icon?: frameWorkIcon;
    description: string;
    documentation?: string;
    //   category?: string;
    executor: (params: IntegrationApiExcutorParams<IN>) => Promise<OUT>;
    //   isHidden?: boolean;
    //   source?: string;
};

type ToolRecord = Record<string, ToolApi<Record<string, any>, Record<string, any>>>;



export function createTool(opts: ToolApi): ToolApi {
    return opts;
}

export abstract class Integration {
    abstract readonly tools: Record<string, ToolApi>;
}

// Helper to extract tools from array of integrations
type IntegrationTools<T extends Integration> = T['tools'];

// Helper to merge all tools from array of integrations
type MergeIntegrationTools<T extends Integration[]> = UnionToIntersection<IntegrationTools<T[number]>>;

// Helper for union to intersection conversion
type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;


export class GmailIntegration extends Integration {
    constructor(config: { apiKey: string }) {
        super();
    }

    readonly tools = {
        gmailGetProfile: createTool({
            label: 'Get Gmail Profile',
            schema: z.object({}),
            description: 'Get the profile of the authenticated user',
            executor: async () => {
                return { email: '' }
            }
        }),
    } as const;
}

// Helper to merge custom tools with integration tools
type AllTools<
  TTools extends ToolRecord | undefined = undefined,
  TIntegrations extends Integration[] | undefined = undefined
> = (TTools extends ToolRecord ? TTools : {}) & 
    (TIntegrations extends Integration[] ? MergeIntegrationTools<TIntegrations> : {});

export class Agent<
    TTools extends Record<string, ToolApi> | undefined = undefined,
    TIntegrations extends Integration[] | undefined = undefined
> {
    private readonly id: string;
    public name: string;
    private readonly instructions: string;
    private readonly model: {
        provider: string;
        name: string;
        toolChoice: string;
    };
    private readonly tools: Partial<Record<keyof AllTools<TTools, TIntegrations>, boolean>>;

    constructor(config: {
        id: string;
        name: string;
        instructions: string;
        model: {
            provider: string;
            name: string;
            toolChoice: string;
        };
        tools?: Partial<Record<keyof AllTools<TTools, TIntegrations>, boolean>>;
    }) {
        this.id = config.id;
        this.name = config.name;
        this.instructions = config.instructions;
        this.model = config.model;
        this.tools = config.tools || {};
    }
}

export class Mastra<
    MastraTools extends Record<string, ToolApi>,
    TIntegrations extends Integration[]
> {
    private tools: AllTools<MastraTools, TIntegrations>;
    private agents: Map<string, Agent<MastraTools, TIntegrations>>;
    private integrations: TIntegrations;
    constructor(config: {
        tools: MastraTools;
        agents: Agent<MastraTools, TIntegrations>[];
        integrations: Integration[];
    }) {
        this.tools = config.tools as AllTools<MastraTools, TIntegrations>;;
        this.agents = new Map(
            config.agents.map(agent => [agent.name, agent])
        );
    }
}