//#region src/plugins/two-factor/client.ts
const twoFactorClient = (options) => {
	return {
		id: "two-factor",
		$InferServerPlugin: {},
		atomListeners: [{
			matcher: (path) => path.startsWith("/two-factor/"),
			signal: "$sessionSignal"
		}],
		pathMethods: {
			"/two-factor/disable": "POST",
			"/two-factor/enable": "POST",
			"/two-factor/send-otp": "POST",
			"/two-factor/generate-backup-codes": "POST"
		},
		fetchPlugins: [{
			id: "two-factor",
			name: "two-factor",
			hooks: { async onSuccess(context) {
				if (context.data?.twoFactorRedirect) {
					if (options?.onTwoFactorRedirect) await options.onTwoFactorRedirect();
				}
			} }
		}]
	};
};

//#endregion
export { twoFactorClient as t };