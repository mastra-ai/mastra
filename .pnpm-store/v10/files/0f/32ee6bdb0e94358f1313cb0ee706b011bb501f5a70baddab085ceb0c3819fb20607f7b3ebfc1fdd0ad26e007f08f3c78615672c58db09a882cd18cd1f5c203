import * as AST from "./ast";
export declare type RuleToNode = {
    template: AST.Template;
    literal: AST.Literal;
    expression: AST.Expression;
    operator: AST.Operator;
    variables: AST.Variable[];
    variable: AST.Variable;
    listMarker: AST.ExplodeModifier;
    substr: AST.SubstrModifier;
    extension: string;
};
export declare function parse(input: string): {
    ast: AST.Template;
    expand: (values: Record<string, unknown>) => string;
    toString: () => string;
};
export declare function parseRule<StartRule extends keyof RuleToNode>(input: string, startRule?: StartRule): RuleToNode[StartRule];
export * from "./expander";
