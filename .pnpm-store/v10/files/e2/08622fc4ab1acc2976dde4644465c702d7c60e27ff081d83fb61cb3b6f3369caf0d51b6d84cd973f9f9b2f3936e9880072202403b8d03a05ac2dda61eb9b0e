import { ThreadMessage } from "../../../types/AssistantTypes";
import { ThreadSuggestion } from "../../core";

type SuggestionAdapterGenerateOptions = {
  messages: readonly ThreadMessage[];
};

export type SuggestionAdapter = {
  generate: (
    options: SuggestionAdapterGenerateOptions,
  ) =>
    | Promise<readonly ThreadSuggestion[]>
    | AsyncGenerator<readonly ThreadSuggestion[], void>;
};
