import type { PipelineType } from "@huggingface/tasks";

export type RepoType = "space" | "dataset" | "model";

export interface RepoId {
	name: string;
	type: RepoType;
}

export type RepoFullName = string | `spaces/${string}` | `datasets/${string}`;

export type RepoDesignation = RepoId | RepoFullName;

/** Actually `hf_${string}`, but for convenience, using the string type */
export type AccessToken = string;

export interface Credentials {
	accessToken: AccessToken;
}

export type SpaceHardwareFlavor =
	| "cpu-basic"
	| "cpu-upgrade"
	| "t4-small"
	| "t4-medium"
	| "l4x1"
	| "l4x4"
	| "a10g-small"
	| "a10g-large"
	| "a10g-largex2"
	| "a10g-largex4"
	| "a100-large"
	| "v5e-1x1"
	| "v5e-2x2"
	| "v5e-2x4";

export type SpaceSdk = "streamlit" | "gradio" | "docker" | "static";

export type SpaceStage =
	| "NO_APP_FILE"
	| "CONFIG_ERROR"
	| "BUILDING"
	| "BUILD_ERROR"
	| "RUNNING"
	| "RUNNING_BUILDING"
	| "RUNTIME_ERROR"
	| "DELETING"
	| "PAUSED"
	| "SLEEPING";

export type AccessTokenRole = "admin" | "write" | "contributor" | "read";

export type AuthType = "access_token" | "app_token" | "app_token_as_user";

export type { PipelineType };

export interface SpaceRuntime {
	stage: SpaceStage;
	sdk?: SpaceSdk;
	sdkVersion?: string;
	errorMessage?: string;
	hardware?: {
		current: SpaceHardwareFlavor | null;
		currentPrettyName?: string;
		requested: SpaceHardwareFlavor | null;
		requestedPrettyName?: string;
	};
	/** when calling /spaces, those props are only fetched if ?full=true */
	resources?: SpaceResourceConfig;
	/** in seconds */
	gcTimeout?: number | null;
}

export interface SpaceResourceRequirement {
	cpu?: string;
	memory?: string;
	gpu?: string;
	gpuModel?: string;
	ephemeral?: string;
}

export interface SpaceResourceConfig {
	requests: SpaceResourceRequirement;
	limits: SpaceResourceRequirement;
	replicas?: number;
	throttled?: boolean;
	is_custom?: boolean;
}

export type License =
	| "apache-2.0"
	| "mit"
	| "openrail"
	| "bigscience-openrail-m"
	| "creativeml-openrail-m"
	| "bigscience-bloom-rail-1.0"
	| "bigcode-openrail-m"
	| "afl-3.0"
	| "artistic-2.0"
	| "bsl-1.0"
	| "bsd"
	| "bsd-2-clause"
	| "bsd-3-clause"
	| "bsd-3-clause-clear"
	| "c-uda"
	| "cc"
	| "cc0-1.0"
	| "cc-by-2.0"
	| "cc-by-2.5"
	| "cc-by-3.0"
	| "cc-by-4.0"
	| "cc-by-sa-3.0"
	| "cc-by-sa-4.0"
	| "cc-by-nc-2.0"
	| "cc-by-nc-3.0"
	| "cc-by-nc-4.0"
	| "cc-by-nd-4.0"
	| "cc-by-nc-nd-3.0"
	| "cc-by-nc-nd-4.0"
	| "cc-by-nc-sa-2.0"
	| "cc-by-nc-sa-3.0"
	| "cc-by-nc-sa-4.0"
	| "cdla-sharing-1.0"
	| "cdla-permissive-1.0"
	| "cdla-permissive-2.0"
	| "wtfpl"
	| "ecl-2.0"
	| "epl-1.0"
	| "epl-2.0"
	| "etalab-2.0"
	| "eupl-1.1"
	| "agpl-3.0"
	| "gfdl"
	| "gpl"
	| "gpl-2.0"
	| "gpl-3.0"
	| "lgpl"
	| "lgpl-2.1"
	| "lgpl-3.0"
	| "isc"
	| "lppl-1.3c"
	| "ms-pl"
	| "mpl-2.0"
	| "odc-by"
	| "odbl"
	| "openrail++"
	| "osl-3.0"
	| "postgresql"
	| "ofl-1.1"
	| "ncsa"
	| "unlicense"
	| "zlib"
	| "pddl"
	| "lgpl-lr"
	| "deepfloyd-if-license"
	| "llama2"
	| "llama3"
	| "gemma"
	| "unknown"
	| "other";
