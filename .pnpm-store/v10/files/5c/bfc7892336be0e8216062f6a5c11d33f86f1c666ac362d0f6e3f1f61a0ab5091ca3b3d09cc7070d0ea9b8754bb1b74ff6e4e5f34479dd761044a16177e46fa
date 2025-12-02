import { AssistantCloudAPI } from "./AssistantCloudAPI";
import { AssistantStream } from "assistant-stream";
type AssistantCloudRunsStreamBody = {
    thread_id: string;
    assistant_id: "system/thread_title";
    messages: readonly unknown[];
};
export declare class AssistantCloudRuns {
    private cloud;
    constructor(cloud: AssistantCloudAPI);
    __internal_getAssistantOptions(assistantId: string): {
        api: string;
        headers: () => Promise<{
            Accept: string;
        }>;
        body: {
            assistant_id: string;
            response_format: string;
            thread_id: string;
        };
    };
    stream(body: AssistantCloudRunsStreamBody): Promise<AssistantStream>;
}
export {};
//# sourceMappingURL=AssistantCloudRuns.d.ts.map