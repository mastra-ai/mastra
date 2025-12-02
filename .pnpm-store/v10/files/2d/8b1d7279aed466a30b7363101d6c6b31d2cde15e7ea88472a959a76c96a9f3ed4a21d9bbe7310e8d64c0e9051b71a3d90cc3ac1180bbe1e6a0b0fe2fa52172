import { Template, Expression, Operator, Variable } from "./ast";

import pctEncode from "pct-encode";
import { abort } from "process";

const encoders = {
  UrlSafe: pctEncode(/[^\w~.-]/g),
  Restricted: pctEncode(/[^\w.~:\/\?#\[\]@!\$&'()*+,;=%-]|%(?!\d\d)/g),
};

export function expandTemplate(
  ast: Template,
  values: Record<string, unknown>
): string {
  const strings = ast.parts.map((part) => {
    switch (part.type) {
      case "literal":
        return part.value;
      case "expression":
        return expandExpression(part, values);
    }
  });
  return strings.join("");
}

interface ExpansionConfig {
  first: string;
  sep: string;
  empty: string;
  named: boolean;
  encode: (s: string) => string;
}

const defaults: ExpansionConfig = {
  first: "",
  sep: ",",
  empty: "",
  encode: encoders.UrlSafe,
  named: false,
};

const OperatorConfigs: { [op in Operator]: ExpansionConfig } = {
  "": { ...defaults },
  "+": { ...defaults, encode: encoders.Restricted },
  "#": { ...defaults, encode: encoders.Restricted, first: "#", empty: "#" },
  "/": { ...defaults, first: "/", sep: "/" },
  ".": { ...defaults, first: ".", sep: ".", empty: "." },
  ";": { ...defaults, first: ";", sep: ";", named: true },
  "?": { ...defaults, first: "?", sep: "&", empty: "=", named: true },
  "&": { ...defaults, first: "&", sep: "&", empty: "=", named: true },
};

export function expandExpression(
  expression: Expression,
  values: Record<string, unknown>
): string {
  const config = OperatorConfigs[expression.operator];

  const strings: string[] = [];
  expression.variables.forEach((variable) => {
    const value = values[variable.name];
    if (!present(value)) return;
    const string = expandVariable(variable, value, config);
    strings.push(string || "");
  });
  if (strings.length === 0) {
    return "";
  }
  const expanded = strings.join(config.sep);
  if (expanded.length === 0) {
    return config.empty;
  }
  return config.first + expanded;
}

function expandVariable(
  variable: Variable,
  value: unknown,
  config: ExpansionConfig
): string | undefined {
  if (value == null) {
    throw new TypeError(
      `tried to expand null value for variable ${variable.name}, this is a bug in uri-template`
    );
  }
  if (variable.modifier?.type === "explode") {
    return expandValueExplode(variable, value, config);
  } else {
    return expandValueSingle(variable, value, config);
  }
}

function expandValueSingle(
  variable: Variable,
  value: unknown,
  { empty, encode, named }: ExpansionConfig
): string {
  if (typeof value === "object" && variable.modifier?.type === "substr") {
    throw new Error(
      "Prefixed variables do not support lists/maps. Check " + variable.name
    );
  }
  let out;
  if (Array.isArray(value)) {
    out = value.map(encode).join(",");
  } else if (typeof value === "object") {
    out = Object.entries(value as object)
      .map((entry) => entry.map(encode).join(","))
      .join(",");
  } else {
    out = (value as string).toString();
    if (variable.modifier?.type === "substr") {
      out = out.substring(0, variable.modifier.length);
    }
    out = encode(out);
  }
  if (named) {
    if (out) {
      out = `${variable.name}=${out}`;
    } else {
      out = `${variable.name}${empty}`;
    }
  }
  return out;
}

function expandValueExplode(
  variable: Variable,
  value: unknown,
  { encode, named, sep }: ExpansionConfig
): string {
  if (Array.isArray(value)) {
    let items = value.map(encode);
    if (named) {
      items = items.map((item) => `${variable.name}=${item}`);
    }
    return items.join(sep);
  } else if (typeof value === "object") {
    const pairs: string[] = [];
    Object.entries(value as object).forEach(([k, v]) => {
      k = encode(k);
      if (Array.isArray(v)) {
        v.forEach((item) => {
          pairs.push(`${k}=${encode(item)}`);
        });
      } else {
        pairs.push(`${k}=${encode(v)}`);
      }
    });
    return pairs.join(sep);
  } else {
    const s = (value as string).toString();
    return encode(s);
  }
}

function present(v: unknown): boolean {
  switch (typeof v) {
    case "undefined":
      return false;
    case "object":
      if (v == null) {
        return false;
      }
      if (Array.isArray(v)) {
        return v.length > 0;
      }
      for (const k in v) {
        if ((v as Record<string, unknown>)[k] != null) return true;
      }
      return false;
    default:
      return true;
  }
}
