"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOOP_CODEC_CONTEXT = exports.CodecContext = void 0;
const NOOP = {
    toDatabase(data) {
        return data;
    },
    fromDatabase(data) {
        return data;
    },
};
class CodecContext {
    spec;
    map;
    constructor(spec) {
        if (spec === null || spec.size === 0) {
            this.spec = null;
        }
        else {
            this.spec = spec;
        }
        this.map = new Map();
    }
    initCodec(codec) {
        const specMap = this.spec;
        const targetTypeName = codec.typeName;
        const s = specMap.get(targetTypeName);
        if (s != null) {
            this.map.set(targetTypeName, s);
            return s;
        }
        const ancestors = codec.ancestors;
        if (ancestors == null) {
            this.map.set(targetTypeName, NOOP);
            return NOOP;
        }
        for (let i = 0; i < ancestors.length; i++) {
            const parent = ancestors[i];
            const s = specMap.get(parent.typeName);
            if (s != null) {
                this.map.set(targetTypeName, s);
                return s;
            }
        }
        this.map.set(targetTypeName, NOOP);
        return NOOP;
    }
    getContainerOverload(kind) {
        if (this.spec === null || !this.spec.size) {
            return;
        }
        return this.spec.get(kind);
    }
    hasOverload(codec) {
        if (this.spec === null || !this.spec.size) {
            return false;
        }
        const op = this.map.get(codec.typeName);
        if (op === NOOP) {
            return false;
        }
        if (op != null) {
            return true;
        }
        return this.initCodec(codec) !== NOOP;
    }
    postDecode(codec, value) {
        if (this.spec === null || !this.spec.size) {
            return value;
        }
        let op = this.map.get(codec.typeName);
        if (op === NOOP) {
            return value;
        }
        if (op == null) {
            op = this.initCodec(codec);
        }
        return op.fromDatabase(value);
    }
    preEncode(codec, value) {
        if (this.spec === null || !this.spec.size) {
            return value;
        }
        let op = this.map.get(codec.typeName);
        if (op === NOOP) {
            return value;
        }
        if (op == null) {
            op = this.initCodec(codec);
        }
        return op.toDatabase(value);
    }
}
exports.CodecContext = CodecContext;
exports.NOOP_CODEC_CONTEXT = new CodecContext(null);
