import type { Credentials } from "../types/public";

export function checkCredentials(credentials?: Credentials): void {
	if (!credentials || credentials.accessToken === undefined || credentials.accessToken === null) {
		return;
	}

	if (!credentials.accessToken.startsWith("hf_")) {
		throw new TypeError("Your access token must start with 'hf_'");
	}
}
