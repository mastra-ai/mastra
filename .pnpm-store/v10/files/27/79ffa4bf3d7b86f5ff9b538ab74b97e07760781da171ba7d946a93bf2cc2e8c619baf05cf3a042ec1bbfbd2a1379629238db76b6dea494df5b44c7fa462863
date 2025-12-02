import { typedInclude } from "../utils/typedInclude";
import type { CommitOutput, CommitParams, CommitProgressEvent, ContentSource } from "./commit";
import { commitIter } from "./commit";

const multipartUploadTracking = new WeakMap<
	(progress: number) => void,
	{
		numParts: number;
		partsProgress: Record<number, number>;
	}
>();

/**
 * Uploads with progress
 *
 * Needs XMLHttpRequest to be available for progress events for uploads
 * Set useWebWorkers to true in order to have progress events for hashing
 */
export async function* uploadFilesWithProgress(params: {
	credentials?: CommitParams["credentials"];
	repo: CommitParams["repo"];
	files: Array<URL | File | { path: string; content: ContentSource }>;
	commitTitle?: CommitParams["title"];
	commitDescription?: CommitParams["description"];
	hubUrl?: CommitParams["hubUrl"];
	branch?: CommitParams["branch"];
	isPullRequest?: CommitParams["isPullRequest"];
	parentCommit?: CommitParams["parentCommit"];
	abortSignal?: CommitParams["abortSignal"];
	/**
	 * Set this to true in order to have progress events for hashing
	 */
	useWebWorkers?: CommitParams["useWebWorkers"];
}): AsyncGenerator<CommitProgressEvent, CommitOutput> {
	return yield* commitIter({
		credentials: params.credentials,
		repo: params.repo,
		operations: params.files.map((file) => ({
			operation: "addOrUpdate",
			path: file instanceof URL ? file.pathname.split("/").at(-1) ?? "file" : "path" in file ? file.path : file.name,
			content: "content" in file ? file.content : file,
		})),
		title: params.commitTitle ?? `Add ${params.files.length} files`,
		description: params.commitDescription,
		hubUrl: params.hubUrl,
		branch: params.branch,
		isPullRequest: params.isPullRequest,
		parentCommit: params.parentCommit,
		useWebWorkers: params.useWebWorkers,
		abortSignal: params.abortSignal,
		fetch: async (input, init) => {
			if (!init) {
				return fetch(input);
			}

			if (
				!typedInclude(["PUT", "POST"], init.method) ||
				!("progressHint" in init) ||
				!init.progressHint ||
				typeof XMLHttpRequest === "undefined" ||
				typeof input !== "string" ||
				(!(init.body instanceof ArrayBuffer) &&
					!(init.body instanceof Blob) &&
					!(init.body instanceof File) &&
					typeof init.body !== "string")
			) {
				return fetch(input, init);
			}

			const progressHint = init.progressHint as {
				progressCallback: (progress: number) => void;
			} & (Record<string, never> | { part: number; numParts: number });
			const progressCallback = progressHint.progressCallback;

			const xhr = new XMLHttpRequest();

			xhr.upload.addEventListener("progress", (event) => {
				if (event.lengthComputable) {
					if (progressHint.part !== undefined) {
						let tracking = multipartUploadTracking.get(progressCallback);
						if (!tracking) {
							tracking = { numParts: progressHint.numParts, partsProgress: {} };
							multipartUploadTracking.set(progressCallback, tracking);
						}
						tracking.partsProgress[progressHint.part] = event.loaded / event.total;
						let totalProgress = 0;
						for (const partProgress of Object.values(tracking.partsProgress)) {
							totalProgress += partProgress;
						}
						if (totalProgress === tracking.numParts) {
							progressCallback(0.9999999999);
						} else {
							progressCallback(totalProgress / tracking.numParts);
						}
					} else {
						if (event.loaded === event.total) {
							progressCallback(0.9999999999);
						} else {
							progressCallback(event.loaded / event.total);
						}
					}
				}
			});

			xhr.open(init.method, input, true);

			if (init.headers) {
				const headers = new Headers(init.headers);
				headers.forEach((value, key) => {
					xhr.setRequestHeader(key, value);
				});
			}

			init.signal?.throwIfAborted();
			xhr.send(init.body);

			return new Promise((resolve, reject) => {
				xhr.addEventListener("load", () => {
					resolve(
						new Response(xhr.responseText, {
							status: xhr.status,
							statusText: xhr.statusText,
							headers: Object.fromEntries(
								xhr
									.getAllResponseHeaders()
									.trim()
									.split("\n")
									.map((header) => [header.slice(0, header.indexOf(":")), header.slice(header.indexOf(":") + 1).trim()])
							),
						})
					);
				});
				xhr.addEventListener("error", () => {
					reject(new Error(xhr.statusText));
				});

				if (init.signal) {
					init.signal.addEventListener("abort", () => {
						xhr.abort();

						try {
							init.signal?.throwIfAborted();
						} catch (err) {
							reject(err);
						}
					});
				}
			});
		},
	});
}
