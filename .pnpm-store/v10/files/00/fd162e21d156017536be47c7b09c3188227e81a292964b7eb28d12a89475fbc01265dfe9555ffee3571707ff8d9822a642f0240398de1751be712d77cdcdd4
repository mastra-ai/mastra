import { t as capitalizeFirstLetter } from "../../misc-D8A8FGv2.mjs";
import "../../url-BLNRhCPO.mjs";
import { n as getClientConfig, t as createDynamicPathProxy } from "../../proxy-BM5uXHJk.mjs";
import "../../parser-kwbb5q_C.mjs";

//#region src/client/svelte/index.ts
function createAuthClient(options) {
	const { pluginPathMethods, pluginsActions, pluginsAtoms, $fetch, atomListeners, $store } = getClientConfig(options);
	let resolvedHooks = {};
	for (const [key, value] of Object.entries(pluginsAtoms)) resolvedHooks[`use${capitalizeFirstLetter(key)}`] = () => value;
	return createDynamicPathProxy({
		...pluginsActions,
		...resolvedHooks,
		$fetch,
		$store
	}, $fetch, pluginPathMethods, pluginsAtoms, atomListeners);
}

//#endregion
export { createAuthClient };