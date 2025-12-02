import { t as getBaseURL } from "./url-BLNRhCPO.mjs";
import { t as parseJSON } from "./parser-kwbb5q_C.mjs";
import { atom, onMount } from "nanostores";
import { createFetch } from "@better-fetch/fetch";

//#region src/client/broadcast-channel.ts
const kBroadcastChannel = Symbol.for("better-auth:broadcast-channel");
const now$1 = () => Math.floor(Date.now() / 1e3);
var WindowBroadcastChannel = class {
	listeners = /* @__PURE__ */ new Set();
	name;
	constructor(name = "better-auth.message") {
		this.name = name;
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	post(message) {
		if (typeof window === "undefined") return;
		try {
			localStorage.setItem(this.name, JSON.stringify({
				...message,
				timestamp: now$1()
			}));
		} catch {}
	}
	setup() {
		if (typeof window === "undefined" || typeof window.addEventListener === "undefined") return () => {};
		const handler = (event) => {
			if (event.key !== this.name) return;
			const message = JSON.parse(event.newValue ?? "{}");
			if (message?.event !== "session" || !message?.data) return;
			this.listeners.forEach((listener) => listener(message));
		};
		window.addEventListener("storage", handler);
		return () => {
			window.removeEventListener("storage", handler);
		};
	}
};
function getGlobalBroadcastChannel(name = "better-auth.message") {
	if (!globalThis[kBroadcastChannel]) globalThis[kBroadcastChannel] = new WindowBroadcastChannel(name);
	return globalThis[kBroadcastChannel];
}

//#endregion
//#region src/client/focus-manager.ts
const kFocusManager = Symbol.for("better-auth:focus-manager");
var WindowFocusManager = class {
	listeners = /* @__PURE__ */ new Set();
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	setFocused(focused) {
		this.listeners.forEach((listener) => listener(focused));
	}
	setup() {
		if (typeof window === "undefined" || typeof document === "undefined" || typeof window.addEventListener === "undefined") return () => {};
		const visibilityHandler = () => {
			if (document.visibilityState === "visible") this.setFocused(true);
		};
		document.addEventListener("visibilitychange", visibilityHandler, false);
		return () => {
			document.removeEventListener("visibilitychange", visibilityHandler, false);
		};
	}
};
function getGlobalFocusManager() {
	if (!globalThis[kFocusManager]) globalThis[kFocusManager] = new WindowFocusManager();
	return globalThis[kFocusManager];
}

//#endregion
//#region src/client/online-manager.ts
const kOnlineManager = Symbol.for("better-auth:online-manager");
var WindowOnlineManager = class {
	listeners = /* @__PURE__ */ new Set();
	isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	setOnline(online) {
		this.isOnline = online;
		this.listeners.forEach((listener) => listener(online));
	}
	setup() {
		if (typeof window === "undefined" || typeof window.addEventListener === "undefined") return () => {};
		const onOnline = () => this.setOnline(true);
		const onOffline = () => this.setOnline(false);
		window.addEventListener("online", onOnline, false);
		window.addEventListener("offline", onOffline, false);
		return () => {
			window.removeEventListener("online", onOnline, false);
			window.removeEventListener("offline", onOffline, false);
		};
	}
};
function getGlobalOnlineManager() {
	if (!globalThis[kOnlineManager]) globalThis[kOnlineManager] = new WindowOnlineManager();
	return globalThis[kOnlineManager];
}

//#endregion
//#region src/client/query.ts
const isServer = () => typeof window === "undefined";
const useAuthQuery = (initializedAtom, path, $fetch, options) => {
	const value = atom({
		data: null,
		error: null,
		isPending: true,
		isRefetching: false,
		refetch: (queryParams) => fn(queryParams)
	});
	const fn = async (queryParams) => {
		return new Promise((resolve) => {
			const opts = typeof options === "function" ? options({
				data: value.get().data,
				error: value.get().error,
				isPending: value.get().isPending
			}) : options;
			$fetch(path, {
				...opts,
				query: {
					...opts?.query,
					...queryParams?.query
				},
				async onSuccess(context) {
					value.set({
						data: context.data,
						error: null,
						isPending: false,
						isRefetching: false,
						refetch: value.value.refetch
					});
					await opts?.onSuccess?.(context);
				},
				async onError(context) {
					const { request } = context;
					const retryAttempts = typeof request.retry === "number" ? request.retry : request.retry?.attempts;
					const retryAttempt = request.retryAttempt || 0;
					if (retryAttempts && retryAttempt < retryAttempts) return;
					value.set({
						error: context.error,
						data: null,
						isPending: false,
						isRefetching: false,
						refetch: value.value.refetch
					});
					await opts?.onError?.(context);
				},
				async onRequest(context) {
					const currentValue = value.get();
					value.set({
						isPending: currentValue.data === null,
						data: currentValue.data,
						error: null,
						isRefetching: true,
						refetch: value.value.refetch
					});
					await opts?.onRequest?.(context);
				}
			}).catch((error) => {
				value.set({
					error,
					data: null,
					isPending: false,
					isRefetching: false,
					refetch: value.value.refetch
				});
			}).finally(() => {
				resolve(void 0);
			});
		});
	};
	initializedAtom = Array.isArray(initializedAtom) ? initializedAtom : [initializedAtom];
	let isMounted = false;
	for (const initAtom of initializedAtom) initAtom.subscribe(async () => {
		if (isServer()) return;
		if (isMounted) await fn();
		else onMount(value, () => {
			const timeoutId = setTimeout(async () => {
				if (!isMounted) {
					await fn();
					isMounted = true;
				}
			}, 0);
			return () => {
				value.off();
				initAtom.off();
				clearTimeout(timeoutId);
			};
		});
	});
	return value;
};

//#endregion
//#region src/client/session-refresh.ts
const now = () => Math.floor(Date.now() / 1e3);
/**
* Rate limit: don't refetch on focus if a session request was made within this many seconds
*/
const FOCUS_REFETCH_RATE_LIMIT_SECONDS = 5;
function createSessionRefreshManager(opts) {
	const { sessionAtom, sessionSignal, $fetch, options = {} } = opts;
	const refetchInterval = options.sessionOptions?.refetchInterval ?? 0;
	const refetchOnWindowFocus = options.sessionOptions?.refetchOnWindowFocus ?? true;
	const refetchWhenOffline = options.sessionOptions?.refetchWhenOffline ?? false;
	const state = {
		lastSync: 0,
		lastSessionRequest: 0,
		cachedSession: void 0
	};
	const shouldRefetch = () => {
		return refetchWhenOffline || getGlobalOnlineManager().isOnline;
	};
	const triggerRefetch = (event) => {
		if (!shouldRefetch()) return;
		if (event?.event === "storage") {
			state.lastSync = now();
			sessionSignal.set(!sessionSignal.get());
			return;
		}
		const currentSession = sessionAtom.get();
		if (event?.event === "poll") {
			state.lastSessionRequest = now();
			$fetch("/get-session").then((res) => {
				sessionAtom.set({
					...currentSession,
					data: res.data,
					error: res.error || null
				});
				state.lastSync = now();
				sessionSignal.set(!sessionSignal.get());
			}).catch(() => {});
			return;
		}
		if (event?.event === "visibilitychange") {
			if (now() - state.lastSessionRequest < FOCUS_REFETCH_RATE_LIMIT_SECONDS && currentSession?.data !== null && currentSession?.data !== void 0) return;
		}
		if (currentSession?.data === null || currentSession?.data === void 0 || event?.event === "visibilitychange") {
			if (event?.event === "visibilitychange") state.lastSessionRequest = now();
			state.lastSync = now();
			sessionSignal.set(!sessionSignal.get());
		}
	};
	const broadcastSessionUpdate = (trigger) => {
		getGlobalBroadcastChannel().post({
			event: "session",
			data: { trigger },
			clientId: Math.random().toString(36).substring(7)
		});
	};
	const setupPolling = () => {
		if (refetchInterval && refetchInterval > 0) state.pollInterval = setInterval(() => {
			if (sessionAtom.get()?.data) triggerRefetch({ event: "poll" });
		}, refetchInterval * 1e3);
	};
	const setupBroadcast = () => {
		state.unsubscribeBroadcast = getGlobalBroadcastChannel().subscribe(() => {
			triggerRefetch({ event: "storage" });
		});
	};
	const setupFocusRefetch = () => {
		if (!refetchOnWindowFocus) return;
		state.unsubscribeFocus = getGlobalFocusManager().subscribe(() => {
			triggerRefetch({ event: "visibilitychange" });
		});
	};
	const setupOnlineRefetch = () => {
		state.unsubscribeOnline = getGlobalOnlineManager().subscribe((online) => {
			if (online) triggerRefetch({ event: "visibilitychange" });
		});
	};
	const init = () => {
		setupPolling();
		setupBroadcast();
		setupFocusRefetch();
		setupOnlineRefetch();
		getGlobalBroadcastChannel().setup();
		getGlobalFocusManager().setup();
		getGlobalOnlineManager().setup();
	};
	const cleanup = () => {
		if (state.pollInterval) {
			clearInterval(state.pollInterval);
			state.pollInterval = void 0;
		}
		if (state.unsubscribeBroadcast) {
			state.unsubscribeBroadcast();
			state.unsubscribeBroadcast = void 0;
		}
		if (state.unsubscribeFocus) {
			state.unsubscribeFocus();
			state.unsubscribeFocus = void 0;
		}
		if (state.unsubscribeOnline) {
			state.unsubscribeOnline();
			state.unsubscribeOnline = void 0;
		}
		state.lastSync = 0;
		state.lastSessionRequest = 0;
		state.cachedSession = void 0;
	};
	return {
		init,
		cleanup,
		triggerRefetch,
		broadcastSessionUpdate
	};
}

//#endregion
//#region src/client/fetch-plugins.ts
const redirectPlugin = {
	id: "redirect",
	name: "Redirect",
	hooks: { onSuccess(context) {
		if (context.data?.url && context.data?.redirect) {
			if (typeof window !== "undefined" && window.location) {
				if (window.location) try {
					window.location.href = context.data.url;
				} catch {}
			}
		}
	} }
};
const userAgentPlugin = {
	id: "user-agent",
	name: "UserAgent",
	hooks: { onRequest(context) {
		context.headers.append("user-agent", "better-auth");
	} }
};

//#endregion
//#region src/client/session-atom.ts
function getSessionAtom($fetch, options) {
	const $signal = atom(false);
	const session = useAuthQuery($signal, "/get-session", $fetch, { method: "GET" });
	onMount(session, () => {
		const refreshManager = createSessionRefreshManager({
			sessionAtom: session,
			sessionSignal: $signal,
			$fetch,
			options
		});
		refreshManager.init();
		return () => {
			refreshManager.cleanup();
		};
	});
	return {
		session,
		$sessionSignal: $signal
	};
}

//#endregion
//#region src/client/config.ts
const getClientConfig = (options, loadEnv) => {
	const isCredentialsSupported = "credentials" in Request.prototype;
	const baseURL = getBaseURL(options?.baseURL, options?.basePath, void 0, loadEnv) ?? "/api/auth";
	const pluginsFetchPlugins = options?.plugins?.flatMap((plugin) => plugin.fetchPlugins).filter((pl) => pl !== void 0) || [];
	const lifeCyclePlugin = {
		id: "lifecycle-hooks",
		name: "lifecycle-hooks",
		hooks: {
			onSuccess: options?.fetchOptions?.onSuccess,
			onError: options?.fetchOptions?.onError,
			onRequest: options?.fetchOptions?.onRequest,
			onResponse: options?.fetchOptions?.onResponse
		}
	};
	const { onSuccess, onError, onRequest, onResponse, ...restOfFetchOptions } = options?.fetchOptions || {};
	const $fetch = createFetch({
		baseURL,
		...isCredentialsSupported ? { credentials: "include" } : {},
		method: "GET",
		jsonParser(text) {
			if (!text) return null;
			return parseJSON(text, { strict: false });
		},
		customFetchImpl: fetch,
		...restOfFetchOptions,
		plugins: [
			lifeCyclePlugin,
			...restOfFetchOptions.plugins || [],
			...options?.disableDefaultFetchPlugins ? [] : [userAgentPlugin, redirectPlugin],
			...pluginsFetchPlugins
		]
	});
	const { $sessionSignal, session } = getSessionAtom($fetch, options);
	const plugins = options?.plugins || [];
	let pluginsActions = {};
	let pluginsAtoms = {
		$sessionSignal,
		session
	};
	let pluginPathMethods = {
		"/sign-out": "POST",
		"/revoke-sessions": "POST",
		"/revoke-other-sessions": "POST",
		"/delete-user": "POST"
	};
	const atomListeners = [{
		signal: "$sessionSignal",
		matcher(path) {
			return path === "/sign-out" || path === "/update-user" || path === "/sign-up/email" || path === "/sign-in/email" || path === "/delete-user" || path === "/verify-email" || path === "/revoke-sessions" || path === "/revoke-session" || path === "/change-email";
		}
	}];
	for (const plugin of plugins) {
		if (plugin.getAtoms) Object.assign(pluginsAtoms, plugin.getAtoms?.($fetch));
		if (plugin.pathMethods) Object.assign(pluginPathMethods, plugin.pathMethods);
		if (plugin.atomListeners) atomListeners.push(...plugin.atomListeners);
	}
	const $store = {
		notify: (signal) => {
			pluginsAtoms[signal].set(!pluginsAtoms[signal].get());
		},
		listen: (signal, listener) => {
			pluginsAtoms[signal].subscribe(listener);
		},
		atoms: pluginsAtoms
	};
	for (const plugin of plugins) if (plugin.getActions) Object.assign(pluginsActions, plugin.getActions?.($fetch, $store, options));
	return {
		get baseURL() {
			return baseURL;
		},
		pluginsActions,
		pluginsAtoms,
		pluginPathMethods,
		atomListeners,
		$fetch,
		$store
	};
};

//#endregion
//#region src/utils/is-atom.ts
function isAtom(value) {
	return typeof value === "object" && value !== null && "get" in value && typeof value.get === "function" && "lc" in value && typeof value.lc === "number";
}

//#endregion
//#region src/client/proxy.ts
function getMethod(path, knownPathMethods, args) {
	const method = knownPathMethods[path];
	const { fetchOptions, query, ...body } = args || {};
	if (method) return method;
	if (fetchOptions?.method) return fetchOptions.method;
	if (body && Object.keys(body).length > 0) return "POST";
	return "GET";
}
function createDynamicPathProxy(routes, client, knownPathMethods, atoms, atomListeners) {
	function createProxy(path = []) {
		return new Proxy(function() {}, {
			get(_, prop) {
				if (typeof prop !== "string") return;
				if (prop === "then" || prop === "catch" || prop === "finally") return;
				const fullPath = [...path, prop];
				let current = routes;
				for (const segment of fullPath) if (current && typeof current === "object" && segment in current) current = current[segment];
				else {
					current = void 0;
					break;
				}
				if (typeof current === "function") return current;
				if (isAtom(current)) return current;
				return createProxy(fullPath);
			},
			apply: async (_, __, args) => {
				const routePath = "/" + path.map((segment) => segment.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)).join("/");
				const arg = args[0] || {};
				const fetchOptions = args[1] || {};
				const { query, fetchOptions: argFetchOptions, ...body } = arg;
				const options = {
					...fetchOptions,
					...argFetchOptions
				};
				const method = getMethod(routePath, knownPathMethods, arg);
				return await client(routePath, {
					...options,
					body: method === "GET" ? void 0 : {
						...body,
						...options?.body || {}
					},
					query: query || options?.query,
					method,
					async onSuccess(context) {
						await options?.onSuccess?.(context);
						if (!atomListeners || options.disableSignal) return;
						/**
						* We trigger listeners
						*/
						const matches = atomListeners.filter((s) => s.matcher(routePath));
						if (!matches.length) return;
						for (const match of matches) {
							const signal = atoms[match.signal];
							if (!signal) return;
							/**
							* To avoid race conditions we set the signal in a setTimeout
							*/
							const val = signal.get();
							setTimeout(() => {
								signal.set(!val);
							}, 10);
						}
					}
				});
			}
		});
	}
	return createProxy();
}

//#endregion
export { kOnlineManager as a, kBroadcastChannel as c, useAuthQuery as i, getClientConfig as n, kFocusManager as o, createSessionRefreshManager as r, getGlobalBroadcastChannel as s, createDynamicPathProxy as t };