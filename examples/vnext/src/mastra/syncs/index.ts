import { SyncConfig } from "@mastra/core";
import { integrations } from "../integrations";
import * as tools from '../tools'


type mySyncParams = {
    name: string
    foo: string
    createdAt: Date
}

export const mySync: SyncConfig<typeof integrations, typeof tools, mySyncParams> = async ({ params, tools, engine, agents }) => {
    // Should autocomplete here
    console.log(params.name)
}