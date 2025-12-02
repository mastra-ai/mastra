import { checkExceptions, createWaiter, WaiterState } from "@smithy/util-waiter";
import { DescribeTableCommand } from "../commands/DescribeTableCommand";
const checkState = async (client, input) => {
    let reason;
    try {
        const result = await client.send(new DescribeTableCommand(input));
        reason = result;
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "ResourceNotFoundException") {
            return { state: WaiterState.SUCCESS, reason };
        }
    }
    return { state: WaiterState.RETRY, reason };
};
export const waitForTableNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    return createWaiter({ ...serviceDefaults, ...params }, input, checkState);
};
export const waitUntilTableNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);
    return checkExceptions(result);
};
