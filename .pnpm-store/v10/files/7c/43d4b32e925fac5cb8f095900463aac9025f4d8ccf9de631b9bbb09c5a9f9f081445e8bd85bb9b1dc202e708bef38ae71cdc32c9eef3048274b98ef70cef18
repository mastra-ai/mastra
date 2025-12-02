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
import { isScalarZeroValue, scalarZeroValue } from "./scalar.js";
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.IMPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const IMPLICIT = 2;
export const unsafeLocal = Symbol.for("reflect unsafe local");
/**
 * Return the selected field of a oneof group.
 *
 * @private
 */
export function unsafeOneofCase(
// biome-ignore lint/suspicious/noExplicitAny: `any` is the best choice for dynamic access
target, oneof) {
    const c = target[oneof.localName].case;
    if (c === undefined) {
        return c;
    }
    return oneof.fields.find((f) => f.localName === c);
}
/**
 * Returns true if the field is set.
 *
 * @private
 */
export function unsafeIsSet(
// biome-ignore lint/suspicious/noExplicitAny: `any` is the best choice for dynamic access
target, field) {
    const name = field.localName;
    if (field.oneof) {
        return target[field.oneof.localName].case === name;
    }
    if (field.presence != IMPLICIT) {
        // Fields with explicit presence have properties on the prototype chain
        // for default / zero values (except for proto3).
        return (target[name] !== undefined &&
            Object.prototype.hasOwnProperty.call(target, name));
    }
    switch (field.fieldKind) {
        case "list":
            return target[name].length > 0;
        case "map":
            return Object.keys(target[name]).length > 0;
        case "scalar":
            return !isScalarZeroValue(field.scalar, target[name]);
        case "enum":
            return target[name] !== field.enum.values[0].number;
    }
    throw new Error("message field with implicit presence");
}
/**
 * Returns true if the field is set, but only for singular fields with explicit
 * presence (proto2).
 *
 * @private
 */
export function unsafeIsSetExplicit(target, localName) {
    return (Object.prototype.hasOwnProperty.call(target, localName) &&
        target[localName] !== undefined);
}
/**
 * Return a field value, respecting oneof groups.
 *
 * @private
 */
export function unsafeGet(target, field) {
    if (field.oneof) {
        const oneof = target[field.oneof.localName];
        if (oneof.case === field.localName) {
            return oneof.value;
        }
        return undefined;
    }
    return target[field.localName];
}
/**
 * Set a field value, respecting oneof groups.
 *
 * @private
 */
export function unsafeSet(target, field, value) {
    if (field.oneof) {
        target[field.oneof.localName] = {
            case: field.localName,
            value: value,
        };
    }
    else {
        target[field.localName] = value;
    }
}
/**
 * Resets the field, so that unsafeIsSet() will return false.
 *
 * @private
 */
export function unsafeClear(
// biome-ignore lint/suspicious/noExplicitAny: `any` is the best choice for dynamic access
target, field) {
    const name = field.localName;
    if (field.oneof) {
        const oneofLocalName = field.oneof.localName;
        if (target[oneofLocalName].case === name) {
            target[oneofLocalName] = { case: undefined };
        }
    }
    else if (field.presence != IMPLICIT) {
        // Fields with explicit presence have properties on the prototype chain
        // for default / zero values (except for proto3). By deleting their own
        // property, the field is reset.
        delete target[name];
    }
    else {
        switch (field.fieldKind) {
            case "map":
                target[name] = {};
                break;
            case "list":
                target[name] = [];
                break;
            case "enum":
                target[name] = field.enum.values[0].number;
                break;
            case "scalar":
                target[name] = scalarZeroValue(field.scalar, field.longAsString);
                break;
        }
    }
}
