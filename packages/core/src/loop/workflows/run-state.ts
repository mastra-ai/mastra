import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { StreamInternal } from '../types';

type State = {
  stepResult: Record<string, any> | undefined;
  responseMetadata: Record<string, any> | undefined;
  modelMetadata: {
    modelId: string;
    modelVersion: string;
    modelProvider: string;
  };
  hasErrored: boolean;
  apiError: unknown | undefined;
  deferredErrorChunk: any | undefined;
  providerOptions: Record<string, any> | undefined;
};

export class AgenticRunState {
  #state: State;
  constructor({ _internal, model }: { _internal: StreamInternal; model: MastraLanguageModel }) {
    this.#state = {
      responseMetadata: {
        id: _internal?.generateId?.(),
        timestamp: _internal?.currentDate?.(),
        modelId: model.modelId,
        modelVersion: model.specificationVersion,
        modelProvider: model.provider,
        headers: undefined,
      },
      modelMetadata: {
        modelId: model.modelId,
        modelVersion: model.specificationVersion,
        modelProvider: model.provider,
      },
      providerOptions: undefined,
      hasErrored: false,
      apiError: undefined,
      deferredErrorChunk: undefined,
      stepResult: undefined,
    };
  }

  setState(state: Partial<State>) {
    this.#state = {
      ...this.#state,
      ...state,
    };
  }

  get state() {
    return this.#state;
  }
}
