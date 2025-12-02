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
import { AnySchema } from "./gen/google/protobuf/any_pb.js";
import { create } from "../create.js";
import { toBinary } from "../to-binary.js";
import { fromBinary, mergeFromBinary } from "../from-binary.js";
export function anyPack(schema, message, into) {
    let ret = false;
    if (!into) {
        into = create(AnySchema);
        ret = true;
    }
    into.value = toBinary(schema, message);
    into.typeUrl = typeNameToUrl(message.$typeName);
    return ret ? into : undefined;
}
export function anyIs(any, descOrTypeName) {
    if (any.typeUrl === "") {
        return false;
    }
    const want = typeof descOrTypeName == "string"
        ? descOrTypeName
        : descOrTypeName.typeName;
    const got = typeUrlToName(any.typeUrl);
    return want === got;
}
export function anyUnpack(any, registryOrMessageDesc) {
    if (any.typeUrl === "") {
        return undefined;
    }
    const desc = registryOrMessageDesc.kind == "message"
        ? registryOrMessageDesc
        : registryOrMessageDesc.getMessage(typeUrlToName(any.typeUrl));
    if (!desc || !anyIs(any, desc)) {
        return undefined;
    }
    return fromBinary(desc, any.value);
}
/**
 * Same as anyUnpack but unpacks into the target message.
 */
export function anyUnpackTo(any, schema, message) {
    if (!anyIs(any, schema)) {
        return undefined;
    }
    return mergeFromBinary(schema, message, any.value);
}
function typeNameToUrl(name) {
    return `type.googleapis.com/${name}`;
}
function typeUrlToName(url) {
    const slash = url.lastIndexOf("/");
    const name = slash >= 0 ? url.substring(slash + 1) : url;
    if (!name.length) {
        throw new Error(`invalid type url: ${url}`);
    }
    return name;
}
