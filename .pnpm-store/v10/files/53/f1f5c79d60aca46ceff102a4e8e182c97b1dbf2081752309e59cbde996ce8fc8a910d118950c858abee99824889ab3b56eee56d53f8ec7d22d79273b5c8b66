import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type CreateCoinbaseChargeSecurity = {
    bearer: string;
};
export type CallData = {
    deadline: string;
    feeAmount: string;
    id: string;
    operator: string;
    prefix: string;
    recipient: string;
    recipientAmount: string;
    recipientCurrency: string;
    refundDestination: string;
    signature: string;
};
export type Metadata = {
    chainId: number;
    contractAddress: string;
    sender: string;
};
export type TransferIntent = {
    callData: CallData;
    metadata: Metadata;
};
export type Web3Data = {
    transferIntent: TransferIntent;
};
export type CreateCoinbaseChargeData = {
    id: string;
    createdAt: string;
    expiresAt: string;
    web3Data: Web3Data;
};
/**
 * Returns the calldata to fulfill the transaction
 */
export type CreateCoinbaseChargeResponse = {
    data: CreateCoinbaseChargeData;
};
/** @internal */
export type CreateCoinbaseChargeSecurity$Outbound = {
    bearer: string;
};
/** @internal */
export declare const CreateCoinbaseChargeSecurity$outboundSchema: z.ZodType<CreateCoinbaseChargeSecurity$Outbound, CreateCoinbaseChargeSecurity>;
export declare function createCoinbaseChargeSecurityToJSON(createCoinbaseChargeSecurity: CreateCoinbaseChargeSecurity): string;
/** @internal */
export declare const CallData$inboundSchema: z.ZodType<CallData, unknown>;
export declare function callDataFromJSON(jsonString: string): SafeParseResult<CallData, SDKValidationError>;
/** @internal */
export declare const Metadata$inboundSchema: z.ZodType<Metadata, unknown>;
export declare function metadataFromJSON(jsonString: string): SafeParseResult<Metadata, SDKValidationError>;
/** @internal */
export declare const TransferIntent$inboundSchema: z.ZodType<TransferIntent, unknown>;
export declare function transferIntentFromJSON(jsonString: string): SafeParseResult<TransferIntent, SDKValidationError>;
/** @internal */
export declare const Web3Data$inboundSchema: z.ZodType<Web3Data, unknown>;
export declare function web3DataFromJSON(jsonString: string): SafeParseResult<Web3Data, SDKValidationError>;
/** @internal */
export declare const CreateCoinbaseChargeData$inboundSchema: z.ZodType<CreateCoinbaseChargeData, unknown>;
export declare function createCoinbaseChargeDataFromJSON(jsonString: string): SafeParseResult<CreateCoinbaseChargeData, SDKValidationError>;
/** @internal */
export declare const CreateCoinbaseChargeResponse$inboundSchema: z.ZodType<CreateCoinbaseChargeResponse, unknown>;
export declare function createCoinbaseChargeResponseFromJSON(jsonString: string): SafeParseResult<CreateCoinbaseChargeResponse, SDKValidationError>;
//# sourceMappingURL=createcoinbasecharge.d.ts.map