import { c as MagicastError, i as parseExpression, n as generateCode, t as builders } from "../builders-hKD4IrLX.js";

//#region src/helpers/deep-merge.ts
function deepMergeObject(magicast, object) {
	if (typeof object === "object" && object !== null) for (const key in object) {
		const magicastValue = magicast[key];
		const objectValue = object[key];
		if (magicastValue === objectValue) continue;
		if (typeof magicastValue === "object" && magicastValue !== null && typeof objectValue === "object" && objectValue !== null) deepMergeObject(magicastValue, objectValue);
		else magicast[key] = objectValue;
	}
}

//#endregion
//#region src/helpers/config.ts
function getDefaultExportOptions(magicast) {
	return configFromNode(magicast.exports.default);
}
/**
* Returns the vite config object from a variable declaration thats
* exported as the default export.
*
* Example:
*
* ```js
* const config = {};
* export default config;
* ```
*
* @param magicast the module
*
* @returns an object containing the proxified config object and the
*          declaration "parent" to attach the modified config to later.
*          If no config declaration is found, undefined is returned.
*/
function getConfigFromVariableDeclaration(magicast) {
	if (magicast.exports.default.$type !== "identifier") throw new MagicastError(`Not supported: Cannot modify this kind of default export (${magicast.exports.default.$type})`);
	const configDecalarationId = magicast.exports.default.$name;
	for (const node of magicast.$ast.body) if (node.type === "VariableDeclaration") {
		for (const declaration of node.declarations) if (declaration.id.type === "Identifier" && declaration.id.name === configDecalarationId && declaration.init) {
			const code = generateCode(declaration.init.type === "TSSatisfiesExpression" ? declaration.init.expression : declaration.init).code;
			return {
				declaration,
				config: configFromNode(parseExpression(code))
			};
		}
	}
	throw new MagicastError("Couldn't find config declaration");
}
function configFromNode(node) {
	if (node.$type === "function-call") return node.$args[0];
	return node;
}

//#endregion
//#region src/helpers/nuxt.ts
function addNuxtModule(magicast, name, optionsKey, options) {
	const config = getDefaultExportOptions(magicast);
	config.modules ||= [];
	if (!config.modules.includes(name)) config.modules.push(name);
	if (optionsKey) {
		config[optionsKey] ||= {};
		deepMergeObject(config[optionsKey], options);
	}
}

//#endregion
//#region src/helpers/vite.ts
function addVitePlugin(magicast, plugin) {
	const config = getDefaultExportOptions(magicast);
	if (config.$type === "identifier") insertPluginIntoVariableDeclarationConfig(magicast, plugin);
	else insertPluginIntoConfig(plugin, config);
	magicast.imports.$prepend({
		from: plugin.from,
		local: plugin.constructor,
		imported: plugin.imported || "default"
	});
	return true;
}
function findVitePluginCall(magicast, plugin) {
	const _plugin = typeof plugin === "string" ? {
		from: plugin,
		imported: "default"
	} : plugin;
	const config = getDefaultExportOptions(magicast);
	const constructor = magicast.imports.$items.find((i) => i.from === _plugin.from && i.imported === (_plugin.imported || "default"))?.local;
	return config.plugins?.find((p) => p && p.$type === "function-call" && p.$callee === constructor);
}
function updateVitePluginConfig(magicast, plugin, handler) {
	const item = findVitePluginCall(magicast, plugin);
	if (!item) return false;
	if (typeof handler === "function") item.$args = handler(item.$args);
	else if (item.$args[0]) deepMergeObject(item.$args[0], handler);
	else item.$args[0] = handler;
	return true;
}
/**
* Insert @param plugin into a config object that's declared as a variable in
* the module (@param magicast).
*/
function insertPluginIntoVariableDeclarationConfig(magicast, plugin) {
	const { config: configObject, declaration } = getConfigFromVariableDeclaration(magicast);
	insertPluginIntoConfig(plugin, configObject);
	if (declaration.init) {
		if (declaration.init.type === "ObjectExpression") declaration.init = generateCode(configObject).code;
		else if (declaration.init.type === "CallExpression" && declaration.init.callee.type === "Identifier") declaration.init = generateCode(builders.functionCall(declaration.init.callee.name, configObject)).code;
		else if (declaration.init.type === "TSSatisfiesExpression") {
			if (declaration.init.expression.type === "ObjectExpression") declaration.init.expression = generateCode(configObject).code;
			if (declaration.init.expression.type === "CallExpression" && declaration.init.expression.callee.type === "Identifier") declaration.init.expression = generateCode(builders.functionCall(declaration.init.expression.callee.name, configObject)).code;
		}
	}
}
function insertPluginIntoConfig(plugin, config) {
	const insertionIndex = plugin.index ?? config.plugins?.length ?? 0;
	config.plugins ||= [];
	config.plugins.splice(insertionIndex, 0, plugin.options ? builders.functionCall(plugin.constructor, plugin.options) : builders.functionCall(plugin.constructor));
}

//#endregion
export { addNuxtModule, addVitePlugin, deepMergeObject, findVitePluginCall, getConfigFromVariableDeclaration, getDefaultExportOptions, updateVitePluginConfig };