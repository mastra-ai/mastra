import { GoogleError, Status } from 'google-gax';
import { AckResponse } from './subscriber';
/**
 * Contains information about ack responses that may be used to build
 * responses to user ack calls.
 *
 * @private
 */
export interface AckErrorInfo {
    transient: boolean;
    response?: AckResponse;
    rawErrorCode?: string;
    grpcErrorCode?: Status;
}
export type AckErrorCodes = Map<string, AckErrorInfo>;
/**
 * Processes the raw RPC information when sending a batch of acks
 * to the Pub/Sub service.
 *
 * @private
 */
export declare function processAckErrorInfo(rpcError: GoogleError): AckErrorCodes;
/**
 * For a completely failed RPC call, this will find the appropriate
 * error information to return to an ack() caller.
 *
 * @private
 */
export declare function processAckRpcError(grpcCode: Status): AckErrorInfo;
