// LICENSE for this file only

// MIT License

// Copyright (c) 2025 AgentbaseAI Inc.
// Copyright (c) 2023 Lars Grammel

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

type State =
  | "ROOT"
  | "FINISH"
  | "INSIDE_STRING"
  | "INSIDE_STRING_ESCAPE"
  | "INSIDE_LITERAL"
  | "INSIDE_NUMBER"
  | "INSIDE_OBJECT_START"
  | "INSIDE_OBJECT_KEY"
  | "INSIDE_OBJECT_AFTER_KEY"
  | "INSIDE_OBJECT_BEFORE_VALUE"
  | "INSIDE_OBJECT_AFTER_VALUE"
  | "INSIDE_OBJECT_AFTER_COMMA"
  | "INSIDE_ARRAY_START"
  | "INSIDE_ARRAY_AFTER_VALUE"
  | "INSIDE_ARRAY_AFTER_COMMA";

// Implemented as a scanner with additional fixing
// that performs a single linear time scan pass over the partial JSON.
//
// The states should ideally match relevant states from the JSON spec:
// https://www.json.org/json-en.html
//
// Please note that invalid JSON is not considered/covered, because it
// is assumed that the resulting JSON will be processed by a standard
// JSON parser that will detect any invalid JSON.

// Returns a tuple of [fixedJson, partialPath]
// partialPath is an array of object/array keys that represent
// the currently partial values. An object is considered partial
// if through appending extra characters to the JSON string, its
// value could change.

// Example input: '{"foo":[{"a":f'
// Example output: ['{"foo":[{"a":false}]}', ['foo', '0']]
// Example input: '{"foo":'
// Example output: ['{}', []]

export function fixJson(input: string): [string, string[]] {
  const stack: State[] = ["ROOT"];
  let lastValidIndex = -1;
  let literalStart: number | null = null;
  const path: string[] = [];
  let currentKey: string | undefined;

  function pushCurrentKeyToPath(): void {
    if (currentKey !== undefined) {
      path.push(JSON.parse('"' + currentKey + '"'));
      currentKey = undefined;
    }
  }

  function processValueStart(char: string, i: number, swapState: State) {
    {
      switch (char) {
        case '"': {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_STRING");

          pushCurrentKeyToPath();
          break;
        }

        case "f":
        case "t":
        case "n": {
          lastValidIndex = i;
          literalStart = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_LITERAL");
          break;
        }

        case "-": {
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");

          pushCurrentKeyToPath();
          break;
        }
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");

          pushCurrentKeyToPath();
          break;
        }

        case "{": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_OBJECT_START");

          pushCurrentKeyToPath();
          break;
        }

        case "[": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_ARRAY_START");

          pushCurrentKeyToPath();
          break;
        }
      }
    }
  }

  function processAfterObjectValue(char: string, i: number) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_OBJECT_AFTER_COMMA");
        break;
      }
      case "}": {
        lastValidIndex = i;
        stack.pop();
        currentKey = path.pop();
        break;
      }
    }
  }

  function processAfterArrayValue(char: string, i: number) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_ARRAY_AFTER_COMMA");
        currentKey = (Number(currentKey) + 1).toString();
        break;
      }
      case "]": {
        lastValidIndex = i;
        stack.pop();
        currentKey = path.pop();
        break;
      }
    }
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    const currentState = stack[stack.length - 1];

    switch (currentState) {
      case "ROOT":
        processValueStart(char, i, "FINISH");
        break;

      case "INSIDE_OBJECT_START": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            currentKey = "";
            break;
          }
          case "}": {
            lastValidIndex = i;
            stack.pop();
            currentKey = path.pop();
            break;
          }
        }
        break;
      }

      case "INSIDE_OBJECT_AFTER_COMMA": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            currentKey = "";
            break;
          }
        }
        break;
      }

      case "INSIDE_OBJECT_KEY": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_AFTER_KEY");
            break;
          }
          case "\\": {
            stack.push("INSIDE_STRING_ESCAPE");
            currentKey += char;
            break;
          }
          default: {
            currentKey += char;
            break;
          }
        }
        break;
      }

      case "INSIDE_OBJECT_AFTER_KEY": {
        switch (char) {
          case ":": {
            stack.pop();
            stack.push("INSIDE_OBJECT_BEFORE_VALUE");

            break;
          }
        }
        break;
      }

      case "INSIDE_OBJECT_BEFORE_VALUE": {
        processValueStart(char, i, "INSIDE_OBJECT_AFTER_VALUE");
        break;
      }

      case "INSIDE_OBJECT_AFTER_VALUE": {
        processAfterObjectValue(char, i);
        break;
      }

      case "INSIDE_STRING": {
        switch (char) {
          case '"': {
            stack.pop();
            lastValidIndex = i;

            currentKey = path.pop();
            break;
          }

          case "\\": {
            stack.push("INSIDE_STRING_ESCAPE");
            break;
          }

          default: {
            lastValidIndex = i;
          }
        }

        break;
      }

      case "INSIDE_ARRAY_START": {
        switch (char) {
          case "]": {
            lastValidIndex = i;
            stack.pop();
            currentKey = path.pop();
            break;
          }

          default: {
            lastValidIndex = i;
            currentKey = "0";
            processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
            break;
          }
        }
        break;
      }

      case "INSIDE_ARRAY_AFTER_VALUE": {
        switch (char) {
          case ",": {
            stack.pop();
            stack.push("INSIDE_ARRAY_AFTER_COMMA");

            currentKey = (Number(currentKey) + 1).toString();
            break;
          }

          case "]": {
            lastValidIndex = i;
            stack.pop();
            currentKey = path.pop();
            break;
          }

          default: {
            lastValidIndex = i;
            break;
          }
        }

        break;
      }

      case "INSIDE_ARRAY_AFTER_COMMA": {
        processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
        break;
      }

      case "INSIDE_STRING_ESCAPE": {
        stack.pop();

        if (stack[stack.length - 1] === "INSIDE_STRING") {
          lastValidIndex = i;
        } else if (stack[stack.length - 1] === "INSIDE_OBJECT_KEY") {
          currentKey += char;
        }

        break;
      }

      case "INSIDE_NUMBER": {
        switch (char) {
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9": {
            lastValidIndex = i;
            break;
          }

          case "e":
          case "E":
          case "-":
          case ".": {
            break;
          }

          case ",": {
            stack.pop();
            currentKey = path.pop();

            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }

            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }

            break;
          }

          case "}": {
            stack.pop();
            currentKey = path.pop();

            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }

            break;
          }

          case "]": {
            stack.pop();
            currentKey = path.pop();

            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }

            break;
          }

          default: {
            stack.pop();
            currentKey = path.pop();
            break;
          }
        }

        break;
      }

      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart!, i + 1);

        if (
          !"false".startsWith(partialLiteral) &&
          !"true".startsWith(partialLiteral) &&
          !"null".startsWith(partialLiteral)
        ) {
          stack.pop();

          if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
            processAfterObjectValue(char, i);
          } else if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
            processAfterArrayValue(char, i);
          }
        } else {
          lastValidIndex = i;
        }

        break;
      }
    }
  }

  let result = input.slice(0, lastValidIndex + 1);

  for (let i = stack.length - 1; i >= 0; i--) {
    const state = stack[i];

    switch (state) {
      case "INSIDE_STRING": {
        result += '"';
        break;
      }

      case "INSIDE_OBJECT_KEY":
      case "INSIDE_OBJECT_AFTER_KEY":
      case "INSIDE_OBJECT_AFTER_COMMA":
      case "INSIDE_OBJECT_START":
      case "INSIDE_OBJECT_BEFORE_VALUE":
      case "INSIDE_OBJECT_AFTER_VALUE": {
        result += "}";
        break;
      }

      case "INSIDE_ARRAY_START":
      case "INSIDE_ARRAY_AFTER_COMMA":
      case "INSIDE_ARRAY_AFTER_VALUE": {
        result += "]";
        break;
      }

      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart!, input.length);

        if ("true".startsWith(partialLiteral)) {
          result += "true".slice(partialLiteral.length);
        } else if ("false".startsWith(partialLiteral)) {
          result += "false".slice(partialLiteral.length);
        } else if ("null".startsWith(partialLiteral)) {
          result += "null".slice(partialLiteral.length);
        }
      }
    }
  }

  return [result, path];
}
