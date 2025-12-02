import { checkExceptions, createWaiter, WaiterState } from "@smithy/util-waiter";
import { DescribeTableCommand } from "../commands/DescribeTableCommand";
const checkState = async (client, input) => {
    let reason;
    try {
        const result = await client.send(new DescribeTableCommand(input));
        reason = result;
        try {
            const returnComparator = () => {
                return result.Table.TableStatus;
            };
            if (returnComparator() === "ACTIVE") {
                return { state: WaiterState.SUCCESS, reason };
            }
        }
        catch (e) { }
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "ResourceNotFoundException") {
            return { state: WaiterState.RETRY, reason };
        }
    }
    return { state: WaiterState.RETRY, reason };
};
export const waitForTableExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    return createWaiter({ ...serviceDefaults, ...params }, input, checkState);
};
export const waitUntilTableExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);
    return checkExceptions(result);
};
