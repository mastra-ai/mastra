import { Client as __Client } from "@smithy/smithy-client";
export { __Client };
export class DynamoDBDocumentClient extends __Client {
    config;
    constructor(client, translateConfig) {
        super(client.config);
        this.config = client.config;
        this.config.translateConfig = translateConfig;
        this.middlewareStack = client.middlewareStack;
        if (this.config?.cacheMiddleware) {
            throw new Error("@aws-sdk/lib-dynamodb - cacheMiddleware=true is not compatible with the" +
                " DynamoDBDocumentClient. This option must be set to false.");
        }
    }
    static from(client, translateConfig) {
        return new DynamoDBDocumentClient(client, translateConfig);
    }
    destroy() {
    }
}
