import { AssistantCloud } from "assistant-cloud";
import { RemoteThreadListAdapter } from "../types";
type ThreadData = {
    externalId: string;
};
type CloudThreadListAdapterOptions = {
    cloud?: AssistantCloud | undefined;
    create?(): Promise<ThreadData>;
    delete?(threadId: string): Promise<void>;
};
export declare const useCloudThreadListAdapter: (adapter: CloudThreadListAdapterOptions) => RemoteThreadListAdapter;
export {};
//# sourceMappingURL=cloud.d.ts.map