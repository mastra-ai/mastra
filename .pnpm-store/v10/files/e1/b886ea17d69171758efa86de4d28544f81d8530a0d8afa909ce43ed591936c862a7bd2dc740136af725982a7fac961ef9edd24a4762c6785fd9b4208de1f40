const require_rolldown_runtime = require('../../../_virtual/rolldown_runtime.cjs');
let __bufbuild_protobuf_wire = require("@bufbuild/protobuf/wire");
__bufbuild_protobuf_wire = require_rolldown_runtime.__toESM(__bufbuild_protobuf_wire);

//#region src/proto/google/protobuf/timestamp.ts
function createBaseTimestamp() {
	return {
		seconds: 0,
		nanos: 0
	};
}
const Timestamp = {
	encode(message, writer = new __bufbuild_protobuf_wire.BinaryWriter()) {
		if (message.seconds !== 0) writer.uint32(8).int64(message.seconds);
		if (message.nanos !== 0) writer.uint32(16).int32(message.nanos);
		return writer;
	},
	decode(input, length) {
		const reader = input instanceof __bufbuild_protobuf_wire.BinaryReader ? input : new __bufbuild_protobuf_wire.BinaryReader(input);
		let end = length === void 0 ? reader.len : reader.pos + length;
		const message = createBaseTimestamp();
		while (reader.pos < end) {
			const tag = reader.uint32();
			switch (tag >>> 3) {
				case 1:
					if (tag !== 8) break;
					message.seconds = longToNumber(reader.int64());
					continue;
				case 2:
					if (tag !== 16) break;
					message.nanos = reader.int32();
					continue;
			}
			if ((tag & 7) === 4 || tag === 0) break;
			reader.skip(tag & 7);
		}
		return message;
	},
	fromJSON(object) {
		return {
			seconds: isSet(object.seconds) ? globalThis.Number(object.seconds) : 0,
			nanos: isSet(object.nanos) ? globalThis.Number(object.nanos) : 0
		};
	},
	toJSON(message) {
		const obj = {};
		if (message.seconds !== 0) obj.seconds = Math.round(message.seconds);
		if (message.nanos !== 0) obj.nanos = Math.round(message.nanos);
		return obj;
	},
	create(base) {
		return Timestamp.fromPartial(base ?? {});
	},
	fromPartial(object) {
		const message = createBaseTimestamp();
		message.seconds = object.seconds ?? 0;
		message.nanos = object.nanos ?? 0;
		return message;
	}
};
function longToNumber(int64) {
	const num = globalThis.Number(int64.toString());
	if (num > globalThis.Number.MAX_SAFE_INTEGER) throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
	if (num < globalThis.Number.MIN_SAFE_INTEGER) throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
	return num;
}
function isSet(value) {
	return value !== null && value !== void 0;
}

//#endregion
exports.Timestamp = Timestamp;
//# sourceMappingURL=timestamp.cjs.map