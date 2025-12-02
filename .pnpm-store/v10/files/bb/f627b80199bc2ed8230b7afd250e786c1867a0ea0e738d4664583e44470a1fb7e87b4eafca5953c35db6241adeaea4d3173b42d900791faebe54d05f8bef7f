import * as estree from 'estree';
import { Rule, ESLint } from 'eslint';

declare const rules: {
    'rules-of-hooks': {
        meta: {
            type: "problem";
            docs: {
                description: string;
                recommended: true;
                url: string;
            };
        };
        create(context: Rule.RuleContext): {
            onCodePathSegmentStart: (segment: Rule.CodePathSegment) => number;
            onCodePathSegmentEnd: () => Rule.CodePathSegment | undefined;
            onCodePathStart: () => number;
            onCodePathEnd(codePath: Rule.CodePath, codePathNode: Rule.Node): void;
            CallExpression(node: estree.CallExpression & Rule.NodeParentExtension): void;
            Identifier(node: estree.Identifier & Rule.NodeParentExtension): void;
            'CallExpression:exit'(node: estree.CallExpression & Rule.NodeParentExtension): void;
            FunctionDeclaration(node: estree.FunctionDeclaration & Rule.NodeParentExtension): void;
            ArrowFunctionExpression(node: estree.ArrowFunctionExpression & Rule.NodeParentExtension): void;
        };
    };
    'exhaustive-deps': {
        meta: {
            type: "suggestion";
            docs: {
                description: string;
                recommended: true;
                url: string;
            };
            fixable: "code";
            hasSuggestions: true;
            schema: {
                type: "object";
                additionalProperties: false;
                enableDangerousAutofixThisMayCauseInfiniteLoops: boolean;
                properties: {
                    additionalHooks: {
                        type: "string";
                    };
                    enableDangerousAutofixThisMayCauseInfiniteLoops: {
                        type: "boolean";
                    };
                };
            }[];
        };
        create(context: Rule.RuleContext): {
            CallExpression: (node: estree.CallExpression) => void;
        };
    };
};
declare const configs: {
    /** Legacy recommended config, to be used with rc-based configurations */
    'recommended-legacy': {
        plugins: string[];
        rules: {
            'react-hooks/rules-of-hooks': "error";
            'react-hooks/exhaustive-deps': "warn";
        };
    };
    /**
     * 'recommended' is currently aliased to the legacy / rc recommended config) to maintain backwards compatibility.
     * This is deprecated and in v6, it will switch to alias the flat recommended config.
     */
    recommended: {
        plugins: string[];
        rules: {
            'react-hooks/rules-of-hooks': "error";
            'react-hooks/exhaustive-deps': "warn";
        };
    };
    /** Latest recommended config, to be used with flat configurations */
    'recommended-latest': {
        name: string;
        plugins: {
            readonly 'react-hooks': ESLint.Plugin;
        };
        rules: {
            'react-hooks/rules-of-hooks': "error";
            'react-hooks/exhaustive-deps': "warn";
        };
    };
};
declare const meta: {
    name: string;
};

export { configs, meta, rules };
