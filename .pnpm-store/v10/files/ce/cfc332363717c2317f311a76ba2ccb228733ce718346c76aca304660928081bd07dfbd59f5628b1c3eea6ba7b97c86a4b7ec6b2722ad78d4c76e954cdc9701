import { type LoadEvaluatorOptions } from "langchain/evaluation";
import type { Run, Example } from "../schemas.js";
/**
 * @deprecated Use `evaluate` instead.
 *
 * This utility function loads a LangChain string evaluator and returns a function
 * which can be used by newer `evaluate` function.
 *
 * @param type Type of string evaluator, one of "criteria" or "labeled_criteria
 * @param options Options for loading the evaluator
 * @returns Evaluator consumable by `evaluate`
 */
export declare function getLangchainStringEvaluator(type: "criteria" | "labeled_criteria", options: LoadEvaluatorOptions & {
    formatEvaluatorInputs?: (run: Run, example: Example) => {
        prediction: string;
        reference?: string;
        input?: string;
    };
}): Promise<(run: Run, example: Example) => Promise<{
    key: string;
}>>;
