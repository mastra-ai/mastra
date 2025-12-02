const test = require('node:test');
const assert = require('node:assert');
const { evaluate } = require("../lib/parse-utils");

/** @type {Array<[string, boolean | undefined]>} */
const testCases = [
    [`defined(NAPI_EXPERIMENTAL)`, false],
    [`!defined(NAPI_EXPERIMENTAL)`, true],
    [`defined(NAPI_EXPERIMENTAL) || defined(NODE_API_EXPERIMENTAL_NOGC_ENV_OPT_OUT)`, undefined],
    [`defined(NAPI_EXPERIMENTAL) && defined(NODE_API_EXPERIMENTAL_NOGC_ENV_OPT_OUT)`, false],
    [`!defined(NAPI_EXPERIMENTAL) || (defined(NAPI_EXPERIMENTAL) && (defined(NODE_API_EXPERIMENTAL_NOGC_ENV_OPT_OUT) || defined(NODE_API_EXPERIMENTAL_BASIC_ENV_OPT_OUT)))`, true],
    [`NAPI_VERSION >= 9`, undefined],
    [`!defined __cplusplus || (defined(_MSC_VER) && _MSC_VER < 1900)`, undefined], // parser error on `defined __cplusplus`
];

for (const [text, expected] of testCases) {
    test(`${text} -> ${expected}`, (t) => {
        const result = evaluate(text);
        assert.strictEqual(result, expected);
    });
}
