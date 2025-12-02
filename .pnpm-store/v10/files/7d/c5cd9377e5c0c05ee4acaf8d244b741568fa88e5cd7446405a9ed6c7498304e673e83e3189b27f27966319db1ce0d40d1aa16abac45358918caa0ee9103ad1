const require_consts = require('./consts.cjs');
const require_env = require('./env.cjs');

//#region src/helpers/devserver.ts
/**
* Attempts to contact the dev server, returning a boolean indicating whether or
* not it was successful.
*
* @example devServerUrl(process.env[envKeys.DevServerUrl], "/your-path")
*/
const devServerAvailable = async (host = require_consts.defaultDevServerHost, fetch) => {
	try {
		const url = devServerUrl(host, "/dev");
		await (await fetch(url.toString())).json();
		return true;
	} catch (_e) {
		return false;
	}
};
/**
* devServerUrl returns a full URL for the given path name.
*
* Because Cloudflare/V8 platforms don't allow process.env, you are expected
* to pass in the host from the dev server env key:
*
* @example devServerUrl(processEnv(envKeys.DevServerUrl), "/your-path")
* @example devServerUrl("http://localhost:8288/", "/your-path")
*/
const devServerUrl = (host = devServerHost$1(), pathname = "") => {
	return new URL(pathname, host.includes("://") ? host : `http://${host}`);
};
/**
* devServerHost exports the development server's domain by inspecting env
* variables, or returns the default development server URL.
*
* This guarantees a specific URL as a string, as opposed to the env export
* which only returns a value of the env var is set.
*/
const devServerHost$1 = () => require_env.devServerHost() || require_consts.defaultDevServerHost;

//#endregion
exports.devServerAvailable = devServerAvailable;
exports.devServerUrl = devServerUrl;
//# sourceMappingURL=devserver.cjs.map