import { t as capitalizeFirstLetter } from "../../misc-D8A8FGv2.mjs";
import "../../url-BLNRhCPO.mjs";
import { n as getClientConfig, t as createDynamicPathProxy } from "../../proxy-BM5uXHJk.mjs";
import "../../parser-kwbb5q_C.mjs";
import { getCurrentInstance, getCurrentScope, onScopeDispose, readonly, shallowRef } from "vue";

//#region src/client/vue/vue-store.ts
function registerStore(store) {
	let instance = getCurrentInstance();
	if (instance && instance.proxy) {
		let vm = instance.proxy;
		("_nanostores" in vm ? vm._nanostores : vm._nanostores = []).push(store);
	}
}
function useStore(store) {
	let state = shallowRef();
	let unsubscribe = store.subscribe((value) => {
		state.value = value;
	});
	if (getCurrentScope()) onScopeDispose(unsubscribe);
	if (process.env.NODE_ENV !== "production") {
		registerStore(store);
		return readonly(state);
	}
	return state;
}

//#endregion
//#region src/client/vue/index.ts
function getAtomKey(str) {
	return `use${capitalizeFirstLetter(str)}`;
}
function createAuthClient(options) {
	const { baseURL, pluginPathMethods, pluginsActions, pluginsAtoms, $fetch, $store, atomListeners } = getClientConfig(options, false);
	let resolvedHooks = {};
	for (const [key, value] of Object.entries(pluginsAtoms)) resolvedHooks[getAtomKey(key)] = () => useStore(value);
	function useSession(useFetch) {
		if (useFetch) {
			const ref = useStore(pluginsAtoms.$sessionSignal);
			return useFetch(`${baseURL}/get-session`, { ref }).then((res) => {
				return {
					data: res.data,
					isPending: false,
					error: res.error
				};
			});
		}
		return resolvedHooks.useSession();
	}
	return createDynamicPathProxy({
		...pluginsActions,
		...resolvedHooks,
		useSession,
		$fetch,
		$store
	}, $fetch, pluginPathMethods, pluginsAtoms, atomListeners);
}

//#endregion
export { createAuthClient };