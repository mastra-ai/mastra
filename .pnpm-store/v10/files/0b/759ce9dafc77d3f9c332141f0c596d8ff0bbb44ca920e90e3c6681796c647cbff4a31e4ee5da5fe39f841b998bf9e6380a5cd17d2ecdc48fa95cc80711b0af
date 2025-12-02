import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility.js';
import type { ModelInformation } from '../types.js';
export declare class DeepSeekSchemaCompatLayer extends SchemaCompatLayer {
    constructor(model: ModelInformation);
    getSchemaTarget(): Targets | undefined;
    shouldApply(): boolean;
    processZodType(value: ZodTypeV3): ZodTypeV3;
    processZodType(value: ZodTypeV4): ZodTypeV4;
}
//# sourceMappingURL=deepseek.d.ts.map