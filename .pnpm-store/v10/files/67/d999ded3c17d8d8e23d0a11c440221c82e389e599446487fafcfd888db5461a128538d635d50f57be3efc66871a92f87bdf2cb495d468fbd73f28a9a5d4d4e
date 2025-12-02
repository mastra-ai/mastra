import * as util from './util';

export type AllowList = (string | number)[];
export type Replacer = (this: any, key: string, value: any) => any;
export type StringifyQuoteOptions = {
  quote?: string,
  quoteNames?: boolean,
};
export type Stringify11Options = StringifyQuoteOptions & {
  /* Allow serializing BigInt values as <num>n.
   * When undefined or true, BigInt values are serialized with the `n` suffix.
   * When false, the `n` suffix is not included after the long numeral.
   */
  withBigInt?: boolean,
  /* Add a trailing comma to arrays and objects, like JSON5.
   * Applicable only when space is used for indenting.
   */
  trailingComma?: boolean,
  /* Use legacy escape sequences, like JSON5.
   * When true, \v, \0, and \x0-\x19 will be serialized as \v, \0, and \x0-\x19
   * When undefined or false, \v, \0, and \x0-\x19 will be serialized as \u000b, \u0000, and \u0000-\u0019
   */
  withLegacyEscapes?: boolean,
};
export type StringifyOptions = Stringify11Options & {
  replacer?: Replacer | AllowList | null,
  space?: string | number | String | Number | null,
};

export function stringify(
  value: any,
  options?: StringifyOptions,
): string | undefined;

export function stringify(
  value: any,
  replacer?: Replacer | null,
  space?: string | number | String | Number | null,
  options?: Stringify11Options,
): string | undefined;

export function stringify(
  value: any,
  allowList?: AllowList,
  space?: string | number | String | Number | null,
  options?: Stringify11Options,
): string | undefined;

export function stringify(
  value: any,
  replacerOrAllowListOrOptions?: Replacer | StringifyOptions | AllowList | null,
  space?: string | number | String | Number | null,
  options?: Stringify11Options,
): string | undefined {
  const stack: any[] = [];
  let indent = '';
  let propertyList: string[] | undefined;
  let replacer: Replacer | undefined;
  let gap = '';
  let quote: string | undefined;
  let withBigInt: boolean | undefined;
  let withLegacyEscapes: boolean | undefined;
  let nameSerializer: Function = serializeKey;
  let trailingComma: string = '';

  const quoteWeights: Record<string, number> = {
    '\'': 0.1,
    '"': 0.2,
  };

  if (
    // replacerOrAllowListOrOptions is StringifyOptions
    replacerOrAllowListOrOptions != null &&
    typeof replacerOrAllowListOrOptions === 'object' &&
    !Array.isArray(replacerOrAllowListOrOptions)
  ) {
    gap = getGap(replacerOrAllowListOrOptions.space);
    if (replacerOrAllowListOrOptions.trailingComma) {
      trailingComma = ',';
    }
    quote = replacerOrAllowListOrOptions.quote?.trim?.();
    if (replacerOrAllowListOrOptions.quoteNames === true) {
      nameSerializer = quoteString;
    }
    if (typeof replacerOrAllowListOrOptions.replacer === 'function') {
      replacer = replacerOrAllowListOrOptions.replacer;
    }
    withBigInt = replacerOrAllowListOrOptions.withBigInt;
    withLegacyEscapes = replacerOrAllowListOrOptions.withLegacyEscapes === true;
  } else {
    if (
      // replacerOrAllowListOrOptions is Replacer
      typeof replacerOrAllowListOrOptions === 'function'
    ) {
      replacer = replacerOrAllowListOrOptions;
    } else if (
      // replacerOrAllowListOrOptions is AllowList
      Array.isArray(replacerOrAllowListOrOptions)
    ) {
      propertyList = [];
      const propertySet: Set<string> = new Set();
      for (const v of replacerOrAllowListOrOptions) {
        const key = v?.toString?.();
        if (key !== undefined) propertySet.add(key);
      }
      propertyList = [...propertySet];
    }

    gap = getGap(space);
    quote = options?.quote?.trim?.();
    if (options?.quoteNames === true) {
      nameSerializer = quoteString;
    }
    withBigInt = options?.withBigInt;
    withLegacyEscapes = options?.withLegacyEscapes === true;
    if (options?.trailingComma) {
      trailingComma = ',';
    }
  }

  const quoteReplacements: { [key: string]: string } = {
    '\'': '\\\'',
    '"': '\\"',
    '\\': '\\\\',
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\v': withLegacyEscapes ? '\\v' : '\\u000b',
    '\0': withLegacyEscapes ? '\\0' : '\\u0000',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };
  const quoteReplacementForNulFollowedByDigit = withLegacyEscapes ? '\\x00' : '\\u0000';

  return serializeProperty('', { '': value });

  function getGap(space?: string | number | String | Number | null) {
    if (typeof space === 'number' || space instanceof Number) {
      const num = Number(space);
      if (isFinite(num) && num > 0) {
        return ' '.repeat(Math.min(10, Math.floor(num)));
      }
    } else if (typeof space === 'string' || space instanceof String) {
      return space.substring(0, 10);
    }

    return '';
  }

  function serializeProperty(key: string, holder: any): string | undefined {
    let value = holder[key];
    if (value != null) {
      if (typeof value.toJSON11 === 'function') {
        value = value.toJSON11(key);
      } else if (typeof value.toJSON5 === 'function') {
        value = value.toJSON5(key);
      } else if (typeof value.toJSON === 'function') {
        value = value.toJSON(key);
      }
    }

    if (replacer) {
      value = replacer.call(holder, key, value);
    }

    if (value instanceof Number) {
      value = Number(value);
    } else if (value instanceof String) {
      value = String(value);
    } else if (value instanceof Boolean) {
      value = value.valueOf();
    }

    switch (value) {
      case null:
        return 'null';
      case true:
        return 'true';
      case false:
        return 'false';
    }

    if (typeof value === 'string') {
      return quoteString(value);
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'bigint') {
      return value.toString() + (withBigInt === false ? '' : 'n');
    }

    if (typeof value === 'object') {
      return Array.isArray(value) ? serializeArray(value) : serializeObject(value);
    }

    return undefined;
  }

  function quoteString(value: string): string {
    let product = '';

    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      switch (c) {
        case '\'':
        case '"':
          quoteWeights[c]++;
          product += c;
          continue;

        case '\0':
          if (util.isDigit(value[i + 1])) {
            product += quoteReplacementForNulFollowedByDigit;
            continue;
          }
      }

      if (quoteReplacements[c]) {
        product += quoteReplacements[c];
        continue;
      }

      if (c < ' ') {
        let hexString = c.charCodeAt(0).toString(16);
        product += withLegacyEscapes
          ? '\\x' + ('00' + hexString).substring(hexString.length)
          : '\\u' + hexString.padStart(4, '0');
        continue;
      }

      product += c;
    }

    const quoteChar = quote || Object.keys(quoteWeights).reduce((a, b) => (quoteWeights[a] < quoteWeights[b]) ? a : b);

    product = product.replace(new RegExp(quoteChar, 'g'), quoteReplacements[quoteChar]);

    return quoteChar + product + quoteChar;
  }

  function serializeObject(value: any): string {
    if (stack.includes(value)) {
      throw TypeError('Converting circular structure to JSON11');
    }

    stack.push(value);

    let stepback = indent;
    indent = indent + gap;

    let keys = propertyList || Object.keys(value);
    let partial: string[] = [];
    for (const key of keys) {
      const propertyString = serializeProperty(key, value);
      if (propertyString !== undefined) {
        let member = nameSerializer(key) + ':';
        if (gap !== '') {
          member += ' ';
        }
        member += propertyString;
        partial.push(member);
      }
    }

    let final: string;
    if (partial.length === 0) {
      final = '{}';
    } else {
      let properties: string;
      if (gap === '') {
        properties = partial.join(',');
        final = '{' + properties + '}';
      } else {
        properties = partial.join(',\n' + indent);
        final = '{\n' + indent + properties + trailingComma + '\n' + stepback + '}';
      }
    }

    stack.pop();
    indent = stepback;
    return final;
  }

  function serializeKey(key: string): string {
    if (key.length === 0) {
      return quoteString(key);
    }

    const firstChar = String.fromCodePoint(key.codePointAt(0)!);
    if (!util.isIdStartChar(firstChar)) {
      return quoteString(key);
    }

    for (let i = firstChar.length; i < key.length; i++) {
      if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)!))) {
        return quoteString(key);
      }
    }

    return key;
  }

  function serializeArray(value: any[]): string {
    if (stack.includes(value)) {
      throw TypeError('Converting circular structure to JSON11');
    }

    stack.push(value);

    let stepback = indent;
    indent = indent + gap;

    let partial: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const propertyString = serializeProperty(String(i), value);
      partial.push((propertyString !== undefined) ? propertyString : 'null');
    }

    let final: string;
    if (partial.length === 0) {
      final = '[]';
    } else {
      if (gap === '') {
        let properties = partial.join(',');
        final = '[' + properties + ']';
      } else {
        let properties = partial.join(',\n' + indent);
        final = '[\n' + indent + properties + trailingComma + '\n' + stepback + ']';
      }
    }

    stack.pop();
    indent = stepback;
    return final;
  }
}
