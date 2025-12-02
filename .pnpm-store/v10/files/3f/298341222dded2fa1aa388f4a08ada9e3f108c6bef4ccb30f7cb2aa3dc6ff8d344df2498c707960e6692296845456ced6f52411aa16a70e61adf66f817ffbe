import { abort } from "process";

export interface Template {
  type: "template";
  parts: (Literal | Expression)[];
}

export interface Literal {
  type: "literal";
  value: string;
}

export interface Expression {
  type: "expression";
  operator: Operator;
  variables: Variable[];
}

export type Operator = "/" | ";" | "." | "?" | "&" | "+" | "#" | "";

export interface Variable {
  type: "variable";
  name: string;
  modifier?: SubstrModifier | ExplodeModifier;
  extension?: string;
}

export interface ExplodeModifier {
  type: "explode";
}

export interface SubstrModifier {
  type: "substr";
  length: number;
}

export function toString(
  node: Template | Literal | Expression | Variable
): string {
  switch (node.type) {
    case "template":
      return node.parts.map(toString).join("");
    case "literal":
      return node.value;
    case "expression":
      return `{${node.operator}${node.variables.map(toString).join(",")}}`;
    case "variable":
      let out = node.name;
      if (node.modifier?.type == "explode") {
        out += "*";
      } else if (node.modifier?.type == "substr") {
        out += `:${node.modifier.length}`;
      }
      if (node.extension) {
        out += `(${node.extension})`;
      }
      return out;
  }
}
