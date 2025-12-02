import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
export declare const ChainId: {
    readonly One: 1;
    readonly OneHundredAndThirtySeven: 137;
    readonly EightThousandFourHundredAndFiftyThree: 8453;
};
export type ChainId = OpenEnum<typeof ChainId>;
/**
 * Create a Coinbase charge for crypto payment
 */
export type CreateChargeRequest = {
    amount: number;
    sender: string;
    chainId: ChainId;
};
/** @internal */
export declare const ChainId$outboundSchema: z.ZodType<number, ChainId>;
/** @internal */
export type CreateChargeRequest$Outbound = {
    amount: number;
    sender: string;
    chain_id: number;
};
/** @internal */
export declare const CreateChargeRequest$outboundSchema: z.ZodType<CreateChargeRequest$Outbound, CreateChargeRequest>;
export declare function createChargeRequestToJSON(createChargeRequest: CreateChargeRequest): string;
//# sourceMappingURL=createchargerequest.d.ts.map