"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLangchainStringEvaluator = getLangchainStringEvaluator;
// eslint-disable-next-line import/no-extraneous-dependencies
const evaluation_1 = require("langchain/evaluation");
const langchain_js_1 = require("../langchain.cjs");
function isStringifiable(value) {
    return (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "bigint");
}
// utility methods for extracting stringified values
// from unknown inputs and records
function getPrimitiveValue(value) {
    if (isStringifiable(value))
        return String(value);
    if (!Array.isArray(value) && typeof value === "object" && value != null) {
        const values = Object.values(value);
        if (values.length === 1 && isStringifiable(values[0])) {
            return String(values[0]);
        }
    }
    return undefined;
}
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
async function getLangchainStringEvaluator(type, options) {
    const evaluator = await (0, evaluation_1.loadEvaluator)(type, options);
    const feedbackKey = getPrimitiveValue(options.criteria) ?? type;
    const formatEvaluatorInputs = options.formatEvaluatorInputs ??
        ((run, example) => {
            const prediction = getPrimitiveValue(run.outputs);
            const reference = getPrimitiveValue(example.outputs);
            const input = getPrimitiveValue(example.inputs);
            if (prediction == null)
                throw new Error("Missing prediction");
            if (type === "criteria")
                return { prediction, input };
            return { prediction, reference, input };
        });
    return async (run, example) => {
        const score = await evaluator.evaluateStrings(formatEvaluatorInputs(run, example), { callbacks: await (0, langchain_js_1.getLangchainCallbacks)() });
        return { key: feedbackKey, ...score };
    };
}
