const parser = require("acorn");

/**
 * @param {string} text Code to evaluate
 * @returns {boolean | undefined} The result of the evaluation, `undefined` if
 * parsing failed or the result is unknown.
 */
function evaluate(text) {
    try {
        const ast = parser.parse(text, { ecmaVersion: 2020 });

        const expressionStatement = ast.body[0];

        if (expressionStatement.type !== "ExpressionStatement") {
            throw new Error("Expected an ExpressionStatement");
        }

        return visitExpression(expressionStatement.expression);
    } catch {
        // Return an unknown result if parsing failed
        return undefined;
    }
}

/**
 * @param {import("acorn").Expression} node
 */
const visitExpression = (node) => {
    if (node.type === "LogicalExpression") {
        return visitLogicalExpression(node);
    } else if (node.type === "UnaryExpression") {
        return visitUnaryExpression(node);
    } else if (node.type === "CallExpression") {
        return visitCallExpression(node);
    } else {
        throw new Error(`Unknown node type: ${node.type} ${JSON.stringify(node)}`);
    }
};

/**
 * @param {import("acorn").LogicalExpression} node
 */
const visitLogicalExpression = (node) => {
    const left = visitExpression(node.left);
    const right = visitExpression(node.right);

    if (node.operator === "&&") {
        // We can shortcircuit regardless of `unknown` if either are false.
        if (left === false || right === false) {
            return false;
        } else if (left === undefined || right === undefined) {
            return undefined;
        } else {
            return left && right;
        }
    } else if (node.operator === "||") {
        if (left === undefined || right === undefined) {
            return undefined;
        } else {
            return left || right;
        }
    }
};

/**
 * @param {import("acorn").UnaryExpression} node
 */
const visitUnaryExpression = (node) => {
    const argument = visitExpression(node.argument);
    if (typeof argument === 'boolean') {
        return !argument;
    }
};

/**
 * @param {import("acorn").CallExpression} node
 */
const visitCallExpression = (node) => {
    const isDefinedExperimentalCall =
        // is `defined(arg)` call
        node.callee.type === 'Identifier' && node.callee.name === 'defined' && node.arguments.length == 1
        // and that arg is `NAPI_EXPERIMENTAL`
        && node.arguments[0].type === 'Identifier' && node.arguments[0].name === 'NAPI_EXPERIMENTAL';

    if (isDefinedExperimentalCall) {
        return false;
    }
};

module.exports = {
    evaluate
};
