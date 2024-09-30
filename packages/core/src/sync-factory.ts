import { z } from 'zod';
import { PropertyType } from '@prisma-app/client';
import { EventHandler } from './types';
import { Integration } from './integration';

function zodToPropertType(zodType: any) {
    if (zodType instanceof z.ZodString) {
        return PropertyType.SINGLE_LINE_TEXT;
    }

    if (zodType instanceof z.ZodBoolean) {
        return PropertyType.BOOLEAN;
    }

    if (zodType instanceof z.ZodRecord) {
        return PropertyType.JSON_OBJECT;
    }

    if (zodType instanceof z.ZodNumber) {
        return PropertyType.NUMBER;
    }

    if (zodType instanceof z.ZodArray) {
        return PropertyType.JSON_ARRAY;
    }

    if (zodType instanceof z.ZodOptional) {
        return zodToPropertType(zodType._def.innerType)
    }

    if (zodType instanceof z.ZodNullable) {
        return zodToPropertType(zodType._def.innerType)
    }

    if (zodType instanceof z.ZodLiteral) {
        return PropertyType.SINGLE_LINE_TEXT;
    }

    if (zodType instanceof z.ZodObject) {
        return PropertyType.JSON_OBJECT;
    }

    // TODO UNIONS

    return undefined
}


export function getResponseDataKey({ responseSchema, listDataKey }: { listDataKey?: string, responseSchema: any }) {
    const fields: any[] = []
    let entityKey

    if (responseSchema && responseSchema instanceof z.ZodLazy) {
        let obj = responseSchema._def.getter()

        if (obj instanceof z.ZodLazy) {
            obj = obj._def.getter()
        }

        if (obj instanceof z.ZodObject) {
            const objDef = obj._def
            const shape = obj._def.shape()

            const keys = Object.keys(shape)

            const listData = keys.find(k => k === listDataKey)

            if (listData) {
                const def = shape[listData]
                if (def instanceof z.ZodArray) {
                    const innerDef = def._def.type
                    if (innerDef && innerDef instanceof z.ZodLazy) {
                        const obj = innerDef._def.getter()
                        if (obj instanceof z.ZodObject) {
                            const shape = obj._def.shape()
                            Object.entries(shape).forEach(([k, v]) => {
                                const type = zodToPropertType(v)

                                if (type) {
                                    fields.push({
                                        name: k,
                                        type,
                                        displayName: k,
                                        visible: true,
                                        order: 1,
                                        modifiable: false,
                                    })
                                }
                            })
                        }
                    }
                }
            } else {
                Object.entries(shape).forEach(([k, v]) => {
                    const type = zodToPropertType(v)
                    if (type) {
                        fields.push({
                            name: k,
                            type,
                            displayName: k,
                            visible: true,
                            order: 1,
                            modifiable: false,
                        })
                    }
                })
            }
        }
    }

    return fields
}


export function allowedKey(key: string) {
    if (key.startsWith('get')) {
        return true
    }

    if (/List/.test(key)) {
        return true
    }

    if(/Get/.test(key)) {
        return true
    }

    return false
}


function transformKey(input: string): string {
    // Use a regular expression to match 'get', followed by any characters and then the first uppercase letter
    return input.replace(/^(get|Get)([A-Z][a-z]*)/, (_, __, firstPart) => {
        // Convert the first meaningful part to lowercase
        return firstPart.toLowerCase();
    }).replace(/^([a-z]+)([A-Z].*)?$/, (_, firstPart) => {
        // Return the first part in lowercase
        return firstPart.toLowerCase();
    }).replace(/^([a-z]+)([A-Z].*)?$/, (_, firstPart) => {
        // Return the first part in lowercase
        return firstPart.toLowerCase();
    });
}

export function getEntityKey(key: string) {
    if (key.startsWith('get')) {
        return transformKey(key)
    }
    return transformKey(key)
}


export function generateSyncs({
    client,
    schema,
    name,
    idKey,
    listDataKey,
}: {
    client: any,
    schema: any,
    name: string
    idKey: string
    listDataKey: string
}) {
    const events: Record<string, any> = {}
    Object.keys(client).filter((k) => k !== 'client').forEach((key) => {
        if (allowedKey(key)) {
            const apiKey = key as Exclude<keyof typeof client, 'client'>;

            const entityKey = getEntityKey(key)

            const schemaKey = `${key}DataSchema` as keyof typeof schema;
            const responseSchemaKey = `${key}ResponseSchema` as keyof typeof schema;

            const inputSchema = (schema?.[schemaKey] ?? z.object({}))
            const responseSchema = (schema?.[responseSchemaKey] ?? z.object({}))

            const properties = getResponseDataKey({ listDataKey, responseSchema })

            const handler: EventHandler<Integration> = ({
                eventKey,
                integrationInstance: { name, getApiClient, dataLayer },
            }) => ({
                id: `${name}-sync-${entityKey}`,
                event: eventKey,
                executor: async ({ event }) => {
                    const { connectionId } = event.user;

                    const options: Record<string, any> = {}

                    if (inputSchema && inputSchema instanceof z.ZodObject) {
                        Object.keys(inputSchema._def.shape()).forEach((k) => {
                            options[k] = event?.data?.[k]
                        })
                    }

                    const api = await getApiClient({ connectionId });

                    const result = await api[apiKey](options as any);

                    // First see if we are getting the list data

                    const resultData = result?.[listDataKey] || [result]

                    const records = (resultData as Record<string, any>[])?.map((d: any) => {
                        return {
                            externalId: d[idKey],
                            data: d,
                            entityType: entityKey.toUpperCase(),
                        };
                    })

                    await dataLayer?.syncData({
                        name,
                        connectionId,
                        data: records,
                        properties,
                        type: entityKey.toUpperCase(),
                        lastSyncId: event?.id!,
                    });
                },
            });

            events[`${name}.${entityKey}/sync`] = {
                schema: inputSchema,
                handler,
            }
        }
    })

    return events
}
