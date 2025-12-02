import type { CreateProjectParams, CreateExampleOptions, Client } from "../../client.js";
import type { EvaluationResult } from "../../evaluation/evaluator.js";
import type { RunTreeConfig } from "../../run_trees.js";
import type { SimpleEvaluator } from "./vendor/evaluatedBy.js";
export { type SimpleEvaluator };
export type LangSmithJestlikeWrapperConfig = Partial<Omit<RunTreeConfig, "client">> & {
    /** @deprecated Use `repetitions` instead. */
    iterations?: number;
    repetitions?: number;
    enableTestTracking?: boolean;
};
export type LangSmithJestlikeWrapperParams<I, O> = {
    id?: string;
    inputs: I;
    referenceOutputs?: O;
    config?: LangSmithJestlikeWrapperConfig;
} & Pick<CreateExampleOptions, "split" | "metadata">;
export type LangSmithJestlikeDescribeWrapperConfig = {
    client?: Client;
    enableTestTracking?: boolean;
    testSuiteName?: string;
} & Partial<Omit<CreateProjectParams, "referenceDatasetId">>;
export type LangSmithJestlikeDescribeWrapper = (name: string, fn: () => void | Promise<void>, config?: LangSmithJestlikeDescribeWrapperConfig) => void;
/** @deprecated Import as `LangSmithJestlikeDescribeWrapper` instead. */
export type LangSmithJestDescribeWrapper = LangSmithJestlikeDescribeWrapper;
export type SimpleEvaluationResult = {
    key: EvaluationResult["key"];
    score: NonNullable<EvaluationResult["score"]>;
    comment?: EvaluationResult["comment"];
};
export type LangSmithJestlikeTestMetadata = {
    exampleId?: string;
    experimentId?: string;
    datasetId?: string;
    testTrackingEnabled: boolean;
    repetition: number;
    split?: string | string[];
};
export type LangSmithJestlikeTestFunction<I, O> = (data: {
    inputs: I;
    referenceOutputs?: O;
    testMetadata: LangSmithJestlikeTestMetadata;
} & Record<string, any>) => unknown | Promise<unknown>;
