// Copyright 2021-2025 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * Return a fully-qualified name for a Protobuf descriptor.
 * For a file descriptor, return the original file path.
 *
 * See https://protobuf.com/docs/language-spec#fully-qualified-names
 */
export function qualifiedName(desc) {
    switch (desc.kind) {
        case "field":
        case "oneof":
        case "rpc":
            return desc.parent.typeName + "." + desc.name;
        case "enum_value": {
            const p = desc.parent.parent
                ? desc.parent.parent.typeName
                : desc.parent.file.proto.package;
            return p + (p.length > 0 ? "." : "") + desc.name;
        }
        case "service":
        case "message":
        case "enum":
        case "extension":
            return desc.typeName;
        case "file":
            return desc.proto.name;
    }
}
/**
 * Converts snake_case to protoCamelCase according to the convention
 * used by protoc to convert a field name to a JSON name.
 */
export function protoCamelCase(snakeCase) {
    let capNext = false;
    const b = [];
    for (let i = 0; i < snakeCase.length; i++) {
        let c = snakeCase.charAt(i);
        switch (c) {
            case "_":
                capNext = true;
                break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
                b.push(c);
                capNext = false;
                break;
            default:
                if (capNext) {
                    capNext = false;
                    c = c.toUpperCase();
                }
                b.push(c);
                break;
        }
    }
    return b.join("");
}
/**
 * Names that cannot be used for object properties because they are reserved
 * by built-in JavaScript properties.
 */
const reservedObjectProperties = new Set([
    // names reserved by JavaScript
    "constructor",
    "toString",
    "toJSON",
    "valueOf",
]);
/**
 * Escapes names that are reserved for ECMAScript built-in object properties.
 *
 * Also see safeIdentifier() from @bufbuild/protoplugin.
 */
export function safeObjectProperty(name) {
    return reservedObjectProperties.has(name) ? name + "$" : name;
}
