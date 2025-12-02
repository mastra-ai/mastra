import "../../misc-D8A8FGv2.mjs";
import "../../url-BLNRhCPO.mjs";
import { i as useAuthQuery } from "../../proxy-BM5uXHJk.mjs";
import "../../parser-kwbb5q_C.mjs";
import "../../client-BK3DQpQu.mjs";
import "../../access-DXuPG0DH.mjs";
import { a as userAc, t as adminAc$1 } from "../../access-Bue6UE97.mjs";
import { t as hasPermission } from "../../has-permission-DN8I_Icv.mjs";
import { a as memberAc, o as ownerAc, r as defaultRoles, t as adminAc } from "../../access-Cr_p-YVH.mjs";
import { n as hasPermissionFn } from "../../permission-ouQCO-51.mjs";
import { t as twoFactorClient } from "../../client-CZZjjkJj.mjs";
import { atom } from "nanostores";

//#region src/plugins/additional-fields/client.ts
const inferAdditionalFields = (schema) => {
	return {
		id: "additional-fields-client",
		$InferServerPlugin: {}
	};
};

//#endregion
//#region src/plugins/admin/client.ts
const adminClient = (options) => {
	const roles = {
		admin: adminAc$1,
		user: userAc,
		...options?.roles
	};
	return {
		id: "admin-client",
		$InferServerPlugin: {},
		getActions: () => ({ admin: { checkRolePermission: (data) => {
			return hasPermission({
				role: data.role,
				options: {
					ac: options?.ac,
					roles
				},
				permissions: data.permissions ?? data.permission
			});
		} } }),
		pathMethods: {
			"/admin/list-users": "GET",
			"/admin/stop-impersonating": "POST"
		}
	};
};

//#endregion
//#region src/plugins/anonymous/client.ts
const anonymousClient = () => {
	return {
		id: "anonymous",
		$InferServerPlugin: {},
		pathMethods: { "/sign-in/anonymous": "POST" },
		atomListeners: [{
			matcher: (path) => path === "/sign-in/anonymous",
			signal: "$sessionSignal"
		}]
	};
};

//#endregion
//#region src/plugins/api-key/client.ts
const apiKeyClient = () => {
	return {
		id: "api-key",
		$InferServerPlugin: {},
		pathMethods: {
			"/api-key/create": "POST",
			"/api-key/delete": "POST",
			"/api-key/delete-all-expired-api-keys": "POST"
		}
	};
};

//#endregion
//#region src/plugins/custom-session/client.ts
const customSessionClient = () => {
	return InferServerPlugin();
};

//#endregion
//#region src/plugins/device-authorization/client.ts
const deviceAuthorizationClient = () => {
	return {
		id: "device-authorization",
		$InferServerPlugin: {},
		pathMethods: {
			"/device/code": "POST",
			"/device/token": "POST",
			"/device": "GET",
			"/device/approve": "POST",
			"/device/deny": "POST"
		}
	};
};

//#endregion
//#region src/plugins/email-otp/client.ts
const emailOTPClient = () => {
	return {
		id: "email-otp",
		$InferServerPlugin: {},
		atomListeners: [{
			matcher: (path) => path === "/email-otp/verify-email" || path === "/sign-in/email-otp",
			signal: "$sessionSignal"
		}]
	};
};

//#endregion
//#region src/plugins/generic-oauth/client.ts
const genericOAuthClient = () => {
	return {
		id: "generic-oauth-client",
		$InferServerPlugin: {}
	};
};

//#endregion
//#region src/plugins/jwt/client.ts
const jwtClient = (options) => {
	const jwksPath = options?.jwks?.jwksPath ?? "/jwks";
	return {
		id: "better-auth-client",
		$InferServerPlugin: {},
		pathMethods: { [jwksPath]: "GET" },
		getActions: ($fetch) => ({ jwks: async (fetchOptions) => {
			return await $fetch(jwksPath, {
				method: "GET",
				...fetchOptions
			});
		} })
	};
};

//#endregion
//#region src/plugins/last-login-method/client.ts
function getCookieValue(name) {
	if (typeof document === "undefined") return null;
	const cookie = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
	return cookie ? cookie.split("=")[1] : null;
}
/**
* Client-side plugin to retrieve the last used login method
*/
const lastLoginMethodClient = (config = {}) => {
	const cookieName = config.cookieName || "better-auth.last_used_login_method";
	return {
		id: "last-login-method-client",
		getActions() {
			return {
				getLastUsedLoginMethod: () => {
					return getCookieValue(cookieName);
				},
				clearLastUsedLoginMethod: () => {
					if (typeof document !== "undefined") document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
				},
				isLastUsedLoginMethod: (method) => {
					return getCookieValue(cookieName) === method;
				}
			};
		}
	};
};

//#endregion
//#region src/plugins/magic-link/client.ts
const magicLinkClient = () => {
	return {
		id: "magic-link",
		$InferServerPlugin: {}
	};
};

//#endregion
//#region src/plugins/multi-session/client.ts
const multiSessionClient = () => {
	return {
		id: "multi-session",
		$InferServerPlugin: {},
		atomListeners: [{
			matcher(path) {
				return path === "/multi-session/set-active";
			},
			signal: "$sessionSignal"
		}]
	};
};

//#endregion
//#region src/plugins/oidc-provider/client.ts
const oidcClient = () => {
	return {
		id: "oidc-client",
		$InferServerPlugin: {}
	};
};

//#endregion
//#region src/plugins/one-tap/client.ts
let isRequestInProgress = false;
const oneTapClient = (options) => {
	return {
		id: "one-tap",
		getActions: ($fetch, _) => ({ oneTap: async (opts, fetchOptions) => {
			if (isRequestInProgress) {
				console.warn("A Google One Tap request is already in progress. Please wait.");
				return;
			}
			isRequestInProgress = true;
			try {
				if (typeof window === "undefined" || !window.document) {
					console.warn("Google One Tap is only available in browser environments");
					return;
				}
				const { autoSelect, cancelOnTapOutside, context } = opts ?? {};
				const contextValue = context ?? options.context ?? "signin";
				await loadGoogleScript();
				await new Promise((resolve, reject) => {
					let isResolved = false;
					const baseDelay = options.promptOptions?.baseDelay ?? 1e3;
					const maxAttempts = options.promptOptions?.maxAttempts ?? 5;
					window.google?.accounts.id.initialize({
						client_id: options.clientId,
						callback: async (response) => {
							isResolved = true;
							try {
								await $fetch("/one-tap/callback", {
									method: "POST",
									body: { idToken: response.credential },
									...opts?.fetchOptions,
									...fetchOptions
								});
								if (!opts?.fetchOptions && !fetchOptions || opts?.callbackURL) window.location.href = opts?.callbackURL ?? "/";
								resolve();
							} catch (error) {
								console.error("Error during One Tap callback:", error);
								reject(error);
							}
						},
						auto_select: autoSelect,
						cancel_on_tap_outside: cancelOnTapOutside,
						context: contextValue,
						...options.additionalOptions
					});
					const handlePrompt = (attempt) => {
						if (isResolved) return;
						window.google?.accounts.id.prompt((notification) => {
							if (isResolved) return;
							if (notification.isDismissedMoment && notification.isDismissedMoment()) if (attempt < maxAttempts) {
								const delay = Math.pow(2, attempt) * baseDelay;
								setTimeout(() => handlePrompt(attempt + 1), delay);
							} else opts?.onPromptNotification?.(notification);
							else if (notification.isSkippedMoment && notification.isSkippedMoment()) if (attempt < maxAttempts) {
								const delay = Math.pow(2, attempt) * baseDelay;
								setTimeout(() => handlePrompt(attempt + 1), delay);
							} else opts?.onPromptNotification?.(notification);
						});
					};
					handlePrompt(0);
				});
			} catch (error) {
				console.error("Error during Google One Tap flow:", error);
				throw error;
			} finally {
				isRequestInProgress = false;
			}
		} }),
		getAtoms($fetch) {
			return {};
		}
	};
};
const loadGoogleScript = () => {
	return new Promise((resolve) => {
		if (window.googleScriptInitialized) {
			resolve();
			return;
		}
		const script = document.createElement("script");
		script.src = "https://accounts.google.com/gsi/client";
		script.async = true;
		script.defer = true;
		script.onload = () => {
			window.googleScriptInitialized = true;
			resolve();
		};
		document.head.appendChild(script);
	});
};

//#endregion
//#region src/plugins/one-time-token/client.ts
const oneTimeTokenClient = () => {
	return {
		id: "one-time-token",
		$InferServerPlugin: {}
	};
};

//#endregion
//#region src/plugins/organization/client.ts
/**
* Using the same `hasPermissionFn` function, but without the need for a `ctx` parameter or the `organizationId` parameter.
*/
const clientSideHasPermission = (input) => {
	return hasPermissionFn(input, input.options.roles || defaultRoles);
};
const organizationClient = (options) => {
	const $listOrg = atom(false);
	const $activeOrgSignal = atom(false);
	const $activeMemberSignal = atom(false);
	const $activeMemberRoleSignal = atom(false);
	const roles = {
		admin: adminAc,
		member: memberAc,
		owner: ownerAc,
		...options?.roles
	};
	return {
		id: "organization",
		$InferServerPlugin: {},
		getActions: ($fetch, _$store, co) => ({
			$Infer: {
				ActiveOrganization: {},
				Organization: {},
				Invitation: {},
				Member: {},
				Team: {}
			},
			organization: { checkRolePermission: (data) => {
				return clientSideHasPermission({
					role: data.role,
					options: {
						ac: options?.ac,
						roles
					},
					permissions: data.permissions ?? data.permission
				});
			} }
		}),
		getAtoms: ($fetch) => {
			const listOrganizations = useAuthQuery($listOrg, "/organization/list", $fetch, { method: "GET" });
			return {
				$listOrg,
				$activeOrgSignal,
				$activeMemberSignal,
				$activeMemberRoleSignal,
				activeOrganization: useAuthQuery([$activeOrgSignal], "/organization/get-full-organization", $fetch, () => ({ method: "GET" })),
				listOrganizations,
				activeMember: useAuthQuery([$activeMemberSignal], "/organization/get-active-member", $fetch, { method: "GET" }),
				activeMemberRole: useAuthQuery([$activeMemberRoleSignal], "/organization/get-active-member-role", $fetch, { method: "GET" })
			};
		},
		pathMethods: {
			"/organization/get-full-organization": "GET",
			"/organization/list-user-teams": "GET"
		},
		atomListeners: [
			{
				matcher(path) {
					return path === "/organization/create" || path === "/organization/delete" || path === "/organization/update";
				},
				signal: "$listOrg"
			},
			{
				matcher(path) {
					return path.startsWith("/organization");
				},
				signal: "$activeOrgSignal"
			},
			{
				matcher(path) {
					return path.startsWith("/organization/set-active");
				},
				signal: "$sessionSignal"
			},
			{
				matcher(path) {
					return path.includes("/organization/update-member-role");
				},
				signal: "$activeMemberSignal"
			},
			{
				matcher(path) {
					return path.includes("/organization/update-member-role");
				},
				signal: "$activeMemberRoleSignal"
			}
		]
	};
};
const inferOrgAdditionalFields = (schema) => {
	return {};
};

//#endregion
//#region src/plugins/phone-number/client.ts
const phoneNumberClient = () => {
	return {
		id: "phoneNumber",
		$InferServerPlugin: {},
		atomListeners: [{
			matcher(path) {
				return path === "/phone-number/update" || path === "/phone-number/verify" || path === "/sign-in/phone-number";
			},
			signal: "$sessionSignal"
		}]
	};
};

//#endregion
//#region src/plugins/siwe/client.ts
const siweClient = () => {
	return {
		id: "siwe",
		$InferServerPlugin: {}
	};
};

//#endregion
//#region src/plugins/username/client.ts
const usernameClient = () => {
	return {
		id: "username",
		$InferServerPlugin: {},
		atomListeners: [{
			matcher: (path) => path === "/sign-in/username",
			signal: "$sessionSignal"
		}]
	};
};

//#endregion
//#region src/client/plugins/infer-plugin.ts
const InferServerPlugin = () => {
	return {
		id: "infer-server-plugin",
		$InferServerPlugin: {}
	};
};

//#endregion
export { InferServerPlugin, adminClient, anonymousClient, apiKeyClient, clientSideHasPermission, customSessionClient, deviceAuthorizationClient, emailOTPClient, genericOAuthClient, inferAdditionalFields, inferOrgAdditionalFields, jwtClient, lastLoginMethodClient, magicLinkClient, multiSessionClient, oidcClient, oneTapClient, oneTimeTokenClient, organizationClient, phoneNumberClient, siweClient, twoFactorClient, usernameClient };