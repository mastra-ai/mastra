import * as grammar from "./grammar.js";
import * as AST from "./ast";
import { expandTemplate } from "./expander";

export type RuleToNode = {
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

export function parse(input: string) {
  const ast = parseRule(input, "template");
  return {
    ast,
    expand: (values: Record<string, unknown>) => expandTemplate(ast, values),
    toString: () => AST.toString(ast),
  };
}

export function parseRule<StartRule extends keyof RuleToNode>(
  input: string,
  startRule = "template" as StartRule
): RuleToNode[StartRule] {
  return grammar.parse(input, { startRule }) as RuleToNode[StartRule];
}

export * from "./expander";
