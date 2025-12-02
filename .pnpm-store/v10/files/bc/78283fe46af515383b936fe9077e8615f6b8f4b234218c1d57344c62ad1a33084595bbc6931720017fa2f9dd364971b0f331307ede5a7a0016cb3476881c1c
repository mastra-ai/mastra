"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.equals = equals;
const scalar_js_1 = require("./reflect/scalar.js");
const reflect_js_1 = require("./reflect/reflect.js");
const descriptors_js_1 = require("./descriptors.js");
const index_js_1 = require("./wkt/index.js");
const extensions_js_1 = require("./extensions.js");
/**
 * Compare two messages of the same type.
 *
 * Note that this function disregards extensions and unknown fields, and that
 * NaN is not equal NaN, following the IEEE standard.
 */
function equals(schema, a, b, options) {
    if (a.$typeName != schema.typeName || b.$typeName != schema.typeName) {
        return false;
    }
    if (a === b) {
        return true;
    }
    return reflectEquals((0, reflect_js_1.reflect)(schema, a), (0, reflect_js_1.reflect)(schema, b), options);
}
function reflectEquals(a, b, opts) {
    if (a.desc.typeName === "google.protobuf.Any" && (opts === null || opts === void 0 ? void 0 : opts.unpackAny) == true) {
        return anyUnpackedEquals(a.message, b.message, opts);
    }
    for (const f of a.fields) {
        if (!fieldEquals(f, a, b, opts)) {
            return false;
        }
    }
    if ((opts === null || opts === void 0 ? void 0 : opts.unknown) == true && !unknownEquals(a, b, opts.registry)) {
        return false;
    }
    if ((opts === null || opts === void 0 ? void 0 : opts.extensions) == true && !extensionsEquals(a, b, opts)) {
        return false;
    }
    return true;
}
// TODO(tstamm) add an option to consider NaN equal to NaN?
function fieldEquals(f, a, b, opts) {
    if (!a.isSet(f) && !b.isSet(f)) {
        return true;
    }
    if (!a.isSet(f) || !b.isSet(f)) {
        return false;
    }
    switch (f.fieldKind) {
        case "scalar":
            return (0, scalar_js_1.scalarEquals)(f.scalar, a.get(f), b.get(f));
        case "enum":
            return a.get(f) === b.get(f);
        case "message":
            return reflectEquals(a.get(f), b.get(f), opts);
        case "map": {
            // TODO(tstamm) can't we compare sizes first?
            const mapA = a.get(f);
            const mapB = b.get(f);
            const keys = [];
            for (const k of mapA.keys()) {
                if (!mapB.has(k)) {
                    return false;
                }
                keys.push(k);
            }
            for (const k of mapB.keys()) {
                if (!mapA.has(k)) {
                    return false;
                }
            }
            for (const key of keys) {
                const va = mapA.get(key);
                const vb = mapB.get(key);
                if (va === vb) {
                    continue;
                }
                switch (f.mapKind) {
                    case "enum":
                        return false;
                    case "message":
                        if (!reflectEquals(va, vb, opts)) {
                            return false;
                        }
                        break;
                    case "scalar":
                        if (!(0, scalar_js_1.scalarEquals)(f.scalar, va, vb)) {
                            return false;
                        }
                        break;
                }
            }
            break;
        }
        case "list": {
            const listA = a.get(f);
            const listB = b.get(f);
            if (listA.size != listB.size) {
                return false;
            }
            for (let i = 0; i < listA.size; i++) {
                const va = listA.get(i);
                const vb = listB.get(i);
                if (va === vb) {
                    continue;
                }
                switch (f.listKind) {
                    case "enum":
                        return false;
                    case "message":
                        if (!reflectEquals(va, vb, opts)) {
                            return false;
                        }
                        break;
                    case "scalar":
                        if (!(0, scalar_js_1.scalarEquals)(f.scalar, va, vb)) {
                            return false;
                        }
                        break;
                }
            }
            break;
        }
    }
    return true;
}
function anyUnpackedEquals(a, b, opts) {
    if (a.typeUrl !== b.typeUrl) {
        return false;
    }
    const unpackedA = (0, index_js_1.anyUnpack)(a, opts.registry);
    const unpackedB = (0, index_js_1.anyUnpack)(b, opts.registry);
    if (unpackedA && unpackedB) {
        const schema = opts.registry.getMessage(unpackedA.$typeName);
        if (schema) {
            return equals(schema, unpackedA, unpackedB, opts);
        }
    }
    return (0, scalar_js_1.scalarEquals)(descriptors_js_1.ScalarType.BYTES, a.value, b.value);
}
function unknownEquals(a, b, registry) {
    function getTrulyUnknown(msg, registry) {
        var _a;
        const u = (_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : [];
        return registry
            ? u.filter((uf) => !registry.getExtensionFor(msg.desc, uf.no))
            : u;
    }
    const unknownA = getTrulyUnknown(a, registry);
    const unknownB = getTrulyUnknown(b, registry);
    if (unknownA.length != unknownB.length) {
        return false;
    }
    for (let i = 0; i < unknownA.length; i++) {
        const a = unknownA[i];
        const b = unknownB[i];
        if (a.no != b.no) {
            return false;
        }
        if (a.wireType != b.wireType) {
            return false;
        }
        if (!(0, scalar_js_1.scalarEquals)(descriptors_js_1.ScalarType.BYTES, a.data, b.data)) {
            return false;
        }
    }
    return true;
}
function extensionsEquals(a, b, opts) {
    function getSetExtensions(msg, registry) {
        var _a;
        return ((_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : [])
            .map((uf) => registry.getExtensionFor(msg.desc, uf.no))
            .filter((e) => e != undefined)
            .filter((e, index, arr) => arr.indexOf(e) === index);
    }
    const extensionsA = getSetExtensions(a, opts.registry);
    const extensionsB = getSetExtensions(b, opts.registry);
    if (extensionsA.length != extensionsB.length ||
        extensionsA.some((e) => !extensionsB.includes(e))) {
        return false;
    }
    for (const extension of extensionsA) {
        const [containerA, field] = (0, extensions_js_1.createExtensionContainer)(extension, (0, extensions_js_1.getExtension)(a.message, extension));
        const [containerB] = (0, extensions_js_1.createExtensionContainer)(extension, (0, extensions_js_1.getExtension)(b.message, extension));
        if (!fieldEquals(field, containerA, containerB, opts)) {
            return false;
        }
    }
    return true;
}
