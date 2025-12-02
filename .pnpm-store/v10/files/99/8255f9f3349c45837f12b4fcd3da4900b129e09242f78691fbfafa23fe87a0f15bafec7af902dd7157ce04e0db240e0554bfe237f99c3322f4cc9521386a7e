import { eventToGenerator } from "./eventToGenerator";
import { hexFromBytes } from "./hexFromBytes";
import { isFrontend } from "./isFrontend";

async function getWebWorkerCode() {
	const sha256Module = await import("../vendor/hash-wasm/sha256-wrapper");
	return URL.createObjectURL(new Blob([sha256Module.createSHA256WorkerCode()]));
}

const pendingWorkers: Worker[] = [];
const runningWorkers: Set<Worker> = new Set();

let resolve: () => void;
let waitPromise: Promise<void> = new Promise((r) => {
	resolve = r;
});

async function getWorker(poolSize?: number): Promise<Worker> {
	{
		const worker = pendingWorkers.pop();
		if (worker) {
			runningWorkers.add(worker);
			return worker;
		}
	}
	if (!poolSize) {
		const worker = new Worker(await getWebWorkerCode());
		runningWorkers.add(worker);
		return worker;
	}

	if (poolSize <= 0) {
		throw new TypeError("Invalid webworker pool size: " + poolSize);
	}

	while (runningWorkers.size >= poolSize) {
		await waitPromise;
	}

	const worker = new Worker(await getWebWorkerCode());
	runningWorkers.add(worker);
	return worker;
}

async function freeWorker(worker: Worker, poolSize: number | undefined): Promise<void> {
	if (!poolSize) {
		return destroyWorker(worker);
	}
	runningWorkers.delete(worker);
	pendingWorkers.push(worker);
	const r = resolve;
	waitPromise = new Promise((r) => {
		resolve = r;
	});
	r();
}

function destroyWorker(worker: Worker): void {
	runningWorkers.delete(worker);
	worker.terminate();
	const r = resolve;
	waitPromise = new Promise((r) => {
		resolve = r;
	});
	r();
}

/**
 * @returns hex-encoded sha
 * @yields progress (0-1)
 */
export async function* sha256(
	buffer: Blob,
	opts?: { useWebWorker?: boolean | { minSize?: number; poolSize?: number }; abortSignal?: AbortSignal }
): AsyncGenerator<number, string> {
	yield 0;

	const maxCryptoSize =
		typeof opts?.useWebWorker === "object" && opts?.useWebWorker.minSize !== undefined
			? opts.useWebWorker.minSize
			: 10_000_000;
	if (buffer.size < maxCryptoSize && globalThis.crypto?.subtle) {
		const res = hexFromBytes(
			new Uint8Array(
				await globalThis.crypto.subtle.digest("SHA-256", buffer instanceof Blob ? await buffer.arrayBuffer() : buffer)
			)
		);

		yield 1;

		return res;
	}

	if (isFrontend) {
		if (opts?.useWebWorker) {
			try {
				const poolSize = typeof opts?.useWebWorker === "object" ? opts.useWebWorker.poolSize : undefined;
				const worker = await getWorker(poolSize);
				return yield* eventToGenerator<number, string>((yieldCallback, returnCallback, rejectCallack) => {
					worker.addEventListener("message", (event) => {
						if (event.data.sha256) {
							freeWorker(worker, poolSize);
							returnCallback(event.data.sha256);
						} else if (event.data.progress) {
							yieldCallback(event.data.progress);

							try {
								opts.abortSignal?.throwIfAborted();
							} catch (err) {
								destroyWorker(worker);
								rejectCallack(err);
							}
						} else {
							destroyWorker(worker);
							rejectCallack(event);
						}
					});
					worker.addEventListener("error", (event) => {
						destroyWorker(worker);
						rejectCallack(event.error);
					});
					worker.postMessage({ file: buffer });
				});
			} catch (err) {
				console.warn("Failed to use web worker for sha256", err);
			}
		}
		if (!wasmModule) {
			wasmModule = await import("../vendor/hash-wasm/sha256-wrapper");
		}

		const sha256 = await wasmModule.createSHA256();
		sha256.init();

		const reader = buffer.stream().getReader();
		const total = buffer.size;
		let bytesDone = 0;

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			sha256.update(value);
			bytesDone += value.length;
			yield bytesDone / total;

			opts?.abortSignal?.throwIfAborted();
		}

		return sha256.digest("hex");
	}

	if (!cryptoModule) {
		cryptoModule = await import("./sha256-node");
	}

	return yield* cryptoModule.sha256Node(buffer, { abortSignal: opts?.abortSignal });
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let cryptoModule: typeof import("./sha256-node");
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let wasmModule: typeof import("../vendor/hash-wasm/sha256-wrapper");
