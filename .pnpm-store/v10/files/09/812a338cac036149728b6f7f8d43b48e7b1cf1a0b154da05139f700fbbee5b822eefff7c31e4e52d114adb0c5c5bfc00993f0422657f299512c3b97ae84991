import { type ModelContextProvider } from "../../model-context/ModelContextTypes";
import type { Unsubscribe } from "../../types/Unsubscribe";
import type { AssistantRuntimeCore } from "./AssistantRuntimeCore";
import { CompositeContextProvider } from "../../utils/CompositeContextProvider";
import { ThreadListRuntimeCore } from "./ThreadListRuntimeCore";

export abstract class BaseAssistantRuntimeCore implements AssistantRuntimeCore {
  protected readonly _contextProvider = new CompositeContextProvider();
  public abstract get threads(): ThreadListRuntimeCore;

  public registerModelContextProvider(
    provider: ModelContextProvider,
  ): Unsubscribe {
    return this._contextProvider.registerModelContextProvider(provider);
  }
}
