export function hexFromBytes(arr: Uint8Array): string {
	if (globalThis.Buffer) {
		return globalThis.Buffer.from(arr).toString("hex");
	} else {
		const bin: string[] = [];
		arr.forEach((byte) => {
			bin.push(byte.toString(16).padStart(2, "0"));
		});
		return bin.join("");
	}
}
