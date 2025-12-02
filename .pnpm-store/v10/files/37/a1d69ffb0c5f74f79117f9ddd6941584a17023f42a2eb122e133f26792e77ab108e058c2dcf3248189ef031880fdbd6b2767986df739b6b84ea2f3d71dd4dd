import { type ModelContextProvider } from "../../model-context/ModelContextTypes";
import type { Unsubscribe } from "../../types/Unsubscribe";
import type { AssistantRuntimeCore } from "./AssistantRuntimeCore";
import { CompositeContextProvider } from "../../utils/CompositeContextProvider";
import { ThreadListRuntimeCore } from "./ThreadListRuntimeCore";
export declare abstract class BaseAssistantRuntimeCore implements AssistantRuntimeCore {
    protected readonly _contextProvider: CompositeContextProvider;
    abstract get threads(): ThreadListRuntimeCore;
    registerModelContextProvider(provider: ModelContextProvider): Unsubscribe;
}
//# sourceMappingURL=BaseAssistantRuntimeCore.d.ts.map