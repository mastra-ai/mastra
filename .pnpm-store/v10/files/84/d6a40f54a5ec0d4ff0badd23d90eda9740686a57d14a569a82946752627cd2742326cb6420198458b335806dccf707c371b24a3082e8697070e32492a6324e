import type { RepoDesignation, RepoId } from "../types/public";

export function toRepoId(repo: RepoDesignation): RepoId {
	if (typeof repo !== "string") {
		return repo;
	}

	if (repo.startsWith("model/") || repo.startsWith("models/")) {
		throw new TypeError(
			"A repo designation for a model should not start with 'models/', directly specify the model namespace / name"
		);
	}

	if (repo.startsWith("space/")) {
		throw new TypeError("Spaces should start with 'spaces/', plural, not 'space/'");
	}

	if (repo.startsWith("dataset/")) {
		throw new TypeError("Datasets should start with 'dataset/', plural, not 'dataset/'");
	}

	const slashes = repo.split("/").length - 1;

	if (repo.startsWith("spaces/")) {
		if (slashes !== 2) {
			throw new TypeError("Space Id must include namespace and name of the space");
		}

		return {
			type: "space",
			name: repo.slice("spaces/".length),
		};
	}

	if (repo.startsWith("datasets/")) {
		if (slashes > 2) {
			throw new TypeError("Too many slashes in repo designation: " + repo);
		}

		return {
			type: "dataset",
			name: repo.slice("datasets/".length),
		};
	}

	if (slashes > 1) {
		throw new TypeError("Too many slashes in repo designation: " + repo);
	}

	return {
		type: "model",
		name: repo,
	};
}
