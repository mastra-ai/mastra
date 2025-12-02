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
import { base64Decode } from "../wire/base64-encoding.js";
import { FileDescriptorProtoSchema } from "../wkt/gen/google/protobuf/descriptor_pb.js";
import { createFileRegistry } from "../registry.js";
import { restoreJsonNames } from "./restore-json-names.js";
import { fromBinary } from "../from-binary.js";
/**
 * Hydrate a file descriptor.
 *
 * @private
 */
export function fileDesc(b64, imports) {
    var _a;
    const root = fromBinary(FileDescriptorProtoSchema, base64Decode(b64));
    root.messageType.forEach(restoreJsonNames);
    root.dependency = (_a = imports === null || imports === void 0 ? void 0 : imports.map((f) => f.proto.name)) !== null && _a !== void 0 ? _a : [];
    const reg = createFileRegistry(root, (protoFileName) => imports === null || imports === void 0 ? void 0 : imports.find((f) => f.proto.name === protoFileName));
    // biome-ignore lint/style/noNonNullAssertion: non-null assertion because we just created the registry from the file we look up
    return reg.getFile(root.name);
}
