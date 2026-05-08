/**
 * Path pattern matching utility
 * Inlined from regexparam v3.0.0 (MIT License)
 * https://github.com/lukeed/regexparam
 *
 * Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export interface ParsedPattern {
  keys: string[] | false;
  pattern: RegExp;
}

/**
 * Parse a route pattern into a RegExp
 * Supports:
 * - Named parameters: /users/:id
 * - Optional parameters: /users/:id?
 * - Wildcards: /files/*
 * - Mixed patterns: /api/:version/users/:id
 */
export function parse(input: string | RegExp, loose?: boolean): ParsedPattern {
  if (input instanceof RegExp) return { keys: false, pattern: input };

  let c: string;
  let o: number;
  let tmp: string | undefined;
  let ext: number;
  const keys: string[] = [];
  let pattern = '';
  const arr = input.split('/');

  arr[0] || arr.shift();

  while ((tmp = arr.shift())) {
    c = tmp[0]!;
    if (c === '*') {
      keys.push(c);
      pattern += tmp[1] === '?' ? '(?:/(.*))?' : '/(.*)';
    } else if (c === ':') {
      o = tmp.indexOf('?', 1);
      ext = tmp.indexOf('.', 1);
      keys.push(tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length));
      pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
      if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    } else {
      pattern += '/' + tmp;
    }
  }

  return {
    keys: keys,
    pattern: new RegExp('^' + pattern + (loose ? '(?=$|/)' : '/?$'), 'i'),
  };
}

/**
 * Test if a path matches a pattern
 */
export function matchPath(path: string, pattern: string | RegExp): boolean {
  const { pattern: regex } = parse(pattern);
  return regex.test(path);
}
