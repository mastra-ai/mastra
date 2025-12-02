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
import { create } from "./create.js";
import { readField } from "./from-binary.js";
import { reflect } from "./reflect/reflect.js";
import { scalarZeroValue } from "./reflect/scalar.js";
import { writeField } from "./to-binary.js";
import { BinaryReader, BinaryWriter } from "./wire/binary-encoding.js";
import { isWrapperDesc } from "./wkt/wrappers.js";
/**
 * Retrieve an extension value from a message.
 *
 * The function never returns undefined. Use hasExtension() to check whether an
 * extension is set. If the extension is not set, this function returns the
 * default value (if one was specified in the protobuf source), or the zero value
 * (for example `0` for numeric types, `[]` for repeated extension fields, and
 * an empty message instance for message fields).
 *
 * Extensions are stored as unknown fields on a message. To mutate an extension
 * value, make sure to store the new value with setExtension() after mutating.
 *
 * If the extension does not extend the given message, an error is raised.
 */
export function getExtension(message, extension) {
    assertExtendee(extension, message);
    const ufs = filterUnknownFields(message.$unknown, extension);
    const [container, field, get] = createExtensionContainer(extension);
    for (const uf of ufs) {
        readField(container, new BinaryReader(uf.data), field, uf.wireType, {
            readUnknownFields: true,
        });
    }
    return get();
}
/**
 * Set an extension value on a message. If the message already has a value for
 * this extension, the value is replaced.
 *
 * If the extension does not extend the given message, an error is raised.
 */
export function setExtension(message, extension, value) {
    var _a;
    assertExtendee(extension, message);
    const ufs = ((_a = message.$unknown) !== null && _a !== void 0 ? _a : []).filter((uf) => uf.no !== extension.number);
    const [container, field] = createExtensionContainer(extension, value);
    const writer = new BinaryWriter();
    writeField(writer, { writeUnknownFields: true }, container, field);
    const reader = new BinaryReader(writer.finish());
    while (reader.pos < reader.len) {
        const [no, wireType] = reader.tag();
        const data = reader.skip(wireType, no);
        ufs.push({ no, wireType, data });
    }
    message.$unknown = ufs;
}
/**
 * Remove an extension value from a message.
 *
 * If the extension does not extend the given message, an error is raised.
 */
export function clearExtension(message, extension) {
    assertExtendee(extension, message);
    if (message.$unknown === undefined) {
        return;
    }
    message.$unknown = message.$unknown.filter((uf) => uf.no !== extension.number);
}
/**
 * Check whether an extension is set on a message.
 */
export function hasExtension(message, extension) {
    var _a;
    return (extension.extendee.typeName === message.$typeName &&
        !!((_a = message.$unknown) === null || _a === void 0 ? void 0 : _a.find((uf) => uf.no === extension.number)));
}
/**
 * Check whether an option is set on a descriptor.
 *
 * Options are extensions to the `google.protobuf.*Options` messages defined in
 * google/protobuf/descriptor.proto. This function gets the option message from
 * the descriptor, and calls hasExtension().
 */
export function hasOption(element, option) {
    const message = element.proto.options;
    if (!message) {
        return false;
    }
    return hasExtension(message, option);
}
/**
 * Retrieve an option value from a descriptor.
 *
 * Options are extensions to the `google.protobuf.*Options` messages defined in
 * google/protobuf/descriptor.proto. This function gets the option message from
 * the descriptor, and calls getExtension(). Same as getExtension(), this
 * function never returns undefined.
 */
export function getOption(element, option) {
    const message = element.proto.options;
    if (!message) {
        const [, , get] = createExtensionContainer(option);
        return get();
    }
    return getExtension(message, option);
}
function filterUnknownFields(unknownFields, extension) {
    if (unknownFields === undefined)
        return [];
    if (extension.fieldKind === "enum" || extension.fieldKind === "scalar") {
        // singular scalar fields do not merge, we pick the last
        for (let i = unknownFields.length - 1; i >= 0; --i) {
            if (unknownFields[i].no == extension.number) {
                return [unknownFields[i]];
            }
        }
        return [];
    }
    return unknownFields.filter((uf) => uf.no === extension.number);
}
/**
 * @private
 */
export function createExtensionContainer(extension, value) {
    const localName = extension.typeName;
    const field = Object.assign(Object.assign({}, extension), { kind: "field", parent: extension.extendee, localName });
    const desc = Object.assign(Object.assign({}, extension.extendee), { fields: [field], members: [field], oneofs: [] });
    const container = create(desc, value !== undefined ? { [localName]: value } : undefined);
    return [
        reflect(desc, container),
        field,
        () => {
            const value = container[localName];
            if (value === undefined) {
                // biome-ignore lint/style/noNonNullAssertion: Only message fields are undefined, rest will have a zero value.
                const desc = extension.message;
                if (isWrapperDesc(desc)) {
                    return scalarZeroValue(desc.fields[0].scalar, desc.fields[0].longAsString);
                }
                return create(desc);
            }
            return value;
        },
    ];
}
function assertExtendee(extension, message) {
    if (extension.extendee.typeName != message.$typeName) {
        throw new Error(`extension ${extension.typeName} can only be applied to message ${extension.extendee.typeName}`);
    }
}
