/**
 * MIT License
 *
 * Copyright (c) 2019 jhonararipe
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
'use strict';
function formatImpl(this: string, ...args_: any[]) {
  // Create variables
  let self = this;
  const __patterns__ = self.match(/({.*?})/g);
  const { REF, FILL_CHAR, MASK_NUMBER, ALIGN_OP, CROP_SIZE, DOT, FRACTION, TYPE_VAR } = {
    REF: 1,
    FILL_CHAR: 2,
    MASK_NUMBER: 3,
    ALIGN_OP: 4,
    CROP_SIZE: 5,
    DOT: 6,
    FRACTION: 7,
    TYPE_VAR: 8,
  };
  const DEFAULT_PLACE = 6;
  const ALL_REGEXP = /{(\w+)?:([^>\^<\d#]|0)?([#%,])?([>^<\.])?(\d+)?(\.)?(\d+)?([eEfFgGdxXobn#%])?}/g;
  const regExpBasic = /{\[?(\w+)\]?}/; // it's not best solution
  const isObject = typeof args_[0] === 'object';
  // types/use logic
  __patterns__?.map((pattern, patt_index) => {
    const kargs = ALL_REGEXP.exec(pattern) || ALL_REGEXP.exec(pattern);
    const wargs = regExpBasic.exec(pattern);

    // Insert values (one 2 one / array / object)
    const INDEX_VAR = (wargs ? wargs[REF] : kargs ? kargs[REF] : patt_index) || patt_index;
    // @ts-expect-error
    const NATUAL_VALUE = isObject ? args_[0][INDEX_VAR] : args_[INDEX_VAR];
    // @ts-expect-error
    let ACTUAL_VALUE = isObject ? args_[0][INDEX_VAR] : args_[INDEX_VAR];

    // Verify sintax/semantic
    if (ACTUAL_VALUE === null || ACTUAL_VALUE === undefined)
      throw new Error(`Replacement index ${INDEX_VAR} out of range for positional args tuple`);
    if (kargs) {
      // If TYPE_VAR is not defined and the first argument is a number, pad a string should from left, so set TYPE_VAR to "d"
      if (kargs[TYPE_VAR] === undefined && typeof ACTUAL_VALUE === 'number') {
        kargs[TYPE_VAR] = 'd';
      }
      const LETTER =
        (!kargs[FILL_CHAR]
          ? false
          : !kargs[ALIGN_OP] && [...'FfbefoxXn'].includes(kargs[FILL_CHAR].toLowerCase())
            ? kargs[FILL_CHAR]
            : kargs[TYPE_VAR]) || kargs[TYPE_VAR];
      //  padronaze
      if (LETTER) {
        const floatSize = pattern.includes('.') ? Number(kargs[FRACTION] || kargs[CROP_SIZE]) : DEFAULT_PLACE;
        switch (LETTER) {
          case 'E':
            ACTUAL_VALUE = ACTUAL_VALUE.toExponential(DEFAULT_PLACE).toUpperCase();
            break;
          case 'e':
            ACTUAL_VALUE = ACTUAL_VALUE.toExponential(DEFAULT_PLACE);
            break;
          case 'X':
            ACTUAL_VALUE = ACTUAL_VALUE.toString(16).toUpperCase();
            break;
          case 'x':
            ACTUAL_VALUE = ACTUAL_VALUE.toString(16); // Hexadecimal
            break;
          case 'b':
            ACTUAL_VALUE = ACTUAL_VALUE.toString(2); // Binary
            break;
          case 'f':
          case 'F':
            ACTUAL_VALUE = ACTUAL_VALUE.toFixed(floatSize);
            break;
          case 'o':
            ACTUAL_VALUE = ACTUAL_VALUE.toString(8); // Octal
            break;
          default:
            break;
        }
        //  mask
        switch (kargs[MASK_NUMBER]) {
          case '#':
            const MASK = {
              x: '0x',
              X: '0X',
              o: '0o',
              b: '0b',
            }[LETTER];
            ACTUAL_VALUE = MASK + ACTUAL_VALUE;
            break;
        }
      }
      // signal
      if (
        // @ts-expect-error
        [...' +-,%'].includes(kargs[FILL_CHAR]) &&
        typeof NATUAL_VALUE === 'number'
      ) {
        ACTUAL_VALUE = ACTUAL_VALUE.toString().replace('-', '');
        if (NATUAL_VALUE >= 0)
          switch (kargs[FILL_CHAR]) {
            case '+':
              ACTUAL_VALUE = '+' + ACTUAL_VALUE;
              break;
            case ' ':
              ACTUAL_VALUE = ' ' + ACTUAL_VALUE;
              break;
            case ',':
              ACTUAL_VALUE = NATUAL_VALUE.toString()
                .split(/(?=(?:...)*$)/)
                .join(kargs[FILL_CHAR]);
              break;
            case '%':
              ACTUAL_VALUE =
                (NATUAL_VALUE * 100).toFixed(
                  // @ts-expect-error
                  kargs[FRACTION] || DEFAULT_PLACE,
                ) + '%';
              break;
          }
        else ACTUAL_VALUE = '-' + ACTUAL_VALUE;
      }
      // space / order / trim
      if (kargs[CROP_SIZE]) {
        ACTUAL_VALUE = ACTUAL_VALUE.toString();
        const FILL_ELEMENT = kargs[FILL_CHAR] || ' ';
        const SIZE_STRING = ACTUAL_VALUE.length;
        const SIZE_ARG = kargs[CROP_SIZE];
        const FILL_LENGTH = SIZE_STRING > SIZE_ARG ? SIZE_STRING : SIZE_ARG;
        const FILL = FILL_ELEMENT.repeat(FILL_LENGTH);

        switch (kargs[ALIGN_OP] || kargs[FILL_CHAR]) {
          case '<':
            ACTUAL_VALUE = ACTUAL_VALUE.padEnd(FILL_LENGTH, FILL_ELEMENT);
            break;
          case '.':
            if (!(LETTER && /[fF]/.test(LETTER))) ACTUAL_VALUE = ACTUAL_VALUE.slice(0, SIZE_ARG);
            break;
          case '>':
            ACTUAL_VALUE = ACTUAL_VALUE.padStart(FILL_LENGTH, FILL_ELEMENT);
            break;
          case '^':
            const length_start = Math.floor((FILL_LENGTH - SIZE_STRING) / 2);
            const string_start = length_start > 0 ? FILL_ELEMENT.repeat(length_start) + ACTUAL_VALUE : ACTUAL_VALUE;

            ACTUAL_VALUE = FILL.replace(RegExp(`.{${string_start.length}}`), string_start);
            break;
          default:
            ACTUAL_VALUE = LETTER
              ? ACTUAL_VALUE.padStart(FILL_LENGTH, FILL_ELEMENT)
              : ACTUAL_VALUE.padEnd(FILL_LENGTH, FILL_ELEMENT);
            break;
        }
      }
    }

    // SET Definitive value
    self = self.replace(pattern, ACTUAL_VALUE);
  });

  return self;
}

export const format = (inputString: string, ...param: any[]) => formatImpl.apply(inputString, param);
