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
export declare type Operator = "/" | ";" | "." | "?" | "&" | "+" | "#" | "";
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
export declare function toString(node: Template | Literal | Expression | Variable): string;
