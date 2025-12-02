import type { SetRequired } from "../../vendor/type-fest/set-required";
import type { RepoType, SpaceHardwareFlavor, SpaceSdk } from "../public";
import type { ApiCommitFile } from "./api-commit";

export type ApiCreateRepoPayload = {
	name: string;
	canonical?: boolean;
	license?: string;
	template?: string;
	organization?: string;
	/** @default false */
	private?: boolean;
	lfsmultipartthresh?: number;
	files?: SetRequired<ApiCommitFile, "content">[];
} & (
	| {
			type: Exclude<RepoType, "space">;
	  }
	| {
			type: "space";
			hardware?: SpaceHardwareFlavor;
			sdk: SpaceSdk;
			sdkVersion?: string;
	  }
);
