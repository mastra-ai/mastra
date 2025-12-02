import "../../url-BLNRhCPO.mjs";
import { n as getClientConfig, t as createDynamicPathProxy } from "../../proxy-BM5uXHJk.mjs";
import "../../parser-kwbb5q_C.mjs";
import { listenKeys } from "nanostores";
import { useCallback, useRef, useSyncExternalStore } from "@lynx-js/react";

//#region src/client/lynx/lynx-store.ts
/**
* Subscribe to store changes and get store's value.
*
* Can be used with store builder too.
*
* ```js
* import { useStore } from 'nanostores/react'
*
* import { router } from '../store/router'
*
* export const Layout = () => {
*   let page = useStore(router)
*   if (page.route === 'home') {
*     return <HomePage />
*   } else {
*     return <Error404 />
*   }
* }
* ```
*
* @param store Store instance.
* @returns Store value.
*/
function useStore(store, options = {}) {
	let snapshotRef = useRef(store.get());
	const { keys, deps = [store, keys] } = options;
	let subscribe = useCallback((onChange) => {
		const emitChange = (value) => {
			if (snapshotRef.current === value) return;
			snapshotRef.current = value;
			onChange();
		};
		emitChange(store.value);
		if (keys?.length) return listenKeys(store, keys, emitChange);
		return store.listen(emitChange);
	}, deps);
	let get = () => snapshotRef.current;
	return useSyncExternalStore(subscribe, get, get);
}

//#endregion
//#region src/client/lynx/index.ts
function getAtomKey(str) {
	return `use${capitalizeFirstLetter(str)}`;
}
function capitalizeFirstLetter(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
function createAuthClient(options) {
	const { pluginPathMethods, pluginsActions, pluginsAtoms, $fetch, $store, atomListeners } = getClientConfig(options);
	let resolvedHooks = {};
	for (const [key, value] of Object.entries(pluginsAtoms)) resolvedHooks[getAtomKey(key)] = () => useStore(value);
	return createDynamicPathProxy({
		...pluginsActions,
		...resolvedHooks,
		$fetch,
		$store
	}, $fetch, pluginPathMethods, pluginsAtoms, atomListeners);
}

//#endregion
export { capitalizeFirstLetter, createAuthClient, useStore };