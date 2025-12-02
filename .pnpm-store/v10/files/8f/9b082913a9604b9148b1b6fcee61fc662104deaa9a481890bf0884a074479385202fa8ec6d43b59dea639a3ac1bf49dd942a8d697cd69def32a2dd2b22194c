import { AssistantCloud } from "assistant-cloud";
import { AssistantRuntime } from "../api";
type ThreadData = {
    externalId: string;
};
type CloudThreadListAdapter = {
    cloud: AssistantCloud;
    runtimeHook: () => AssistantRuntime;
    create?(): Promise<ThreadData>;
    delete?(threadId: string): Promise<void>;
};
export declare const useCloudThreadListRuntime: ({ runtimeHook, ...adapterOptions }: CloudThreadListAdapter) => import("../internal").AssistantRuntimeImpl;
export {};
//# sourceMappingURL=useCloudThreadListRuntime.d.ts.map