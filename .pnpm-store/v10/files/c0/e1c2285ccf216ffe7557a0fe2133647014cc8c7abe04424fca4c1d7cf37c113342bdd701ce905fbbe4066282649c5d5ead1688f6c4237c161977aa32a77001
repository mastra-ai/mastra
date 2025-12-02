
//#region src/components/connect/os.ts
async function retrieveSystemAttributes() {
	return {
		cpuCores: await retrieveCpuCores(),
		memBytes: await retrieveMemBytes(),
		os: await retrieveOs()
	};
}
async function retrieveCpuCores() {
	try {
		return (await import("node:os")).cpus().length;
	} catch (_err) {}
	try {
		if (navigator && navigator.hardwareConcurrency) return navigator.hardwareConcurrency;
	} catch (_err) {}
	return 0;
}
async function retrieveMemBytes() {
	try {
		if (Deno) return Deno.systemMemoryInfo().total;
	} catch (_err) {}
	try {
		return (await import("node:os")).totalmem();
	} catch (_err) {}
	return 0;
}
async function retrieveOs() {
	try {
		return (await import("node:os")).platform();
	} catch (_err) {}
	try {
		if (navigator && navigator.platform) return navigator.platform;
	} catch (_err) {}
	return "unknown";
}
function onShutdown(signals, fn) {
	try {
		if (Deno) {
			signals.forEach((signal) => {
				Deno.addSignalListener(signal, fn);
			});
			return () => {
				signals.forEach((signal) => {
					Deno.removeSignalListener(signal, fn);
				});
			};
		}
	} catch (_err) {}
	try {
		if (process) {
			signals.forEach((signal) => {
				process.on(signal, fn);
			});
			return () => {
				signals.forEach((signal) => {
					process.removeListener(signal, fn);
				});
			};
		}
	} catch (_err) {}
	return () => {};
}
async function getHostname() {
	try {
		if (Deno) return Deno.hostname();
	} catch (_err) {}
	try {
		return (await import("node:os")).hostname();
	} catch (_err) {}
	return "unknown";
}

//#endregion
exports.getHostname = getHostname;
exports.onShutdown = onShutdown;
exports.retrieveSystemAttributes = retrieveSystemAttributes;
//# sourceMappingURL=os.cjs.map