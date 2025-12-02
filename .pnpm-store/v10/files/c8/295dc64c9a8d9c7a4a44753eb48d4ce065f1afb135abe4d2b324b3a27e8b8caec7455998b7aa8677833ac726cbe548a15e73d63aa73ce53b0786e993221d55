'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const getAddMessage = async (changeset, options) => {
  const skipCI = (options === null || options === void 0 ? void 0 : options.skipCI) === "add" || (options === null || options === void 0 ? void 0 : options.skipCI) === true;
  const skipMsg = skipCI ? `\n\n[skip ci]\n` : "";
  return `docs(changeset): ${changeset.summary}${skipMsg}`;
};
const getVersionMessage = async (releasePlan, options) => {
  const skipCI = (options === null || options === void 0 ? void 0 : options.skipCI) === "version" || (options === null || options === void 0 ? void 0 : options.skipCI) === true;
  const publishableReleases = releasePlan.releases.filter(release => release.type !== "none");
  const numPackagesReleased = publishableReleases.length;
  const releasesLines = publishableReleases.map(release => `  ${release.name}@${release.newVersion}`).join("\n");
  return `RELEASING: Releasing ${numPackagesReleased} package(s)

Releases:
${releasesLines}
${skipCI ? `\n[skip ci]\n` : ""}`;
};
const defaultCommitFunctions = {
  getAddMessage,
  getVersionMessage
};

exports["default"] = defaultCommitFunctions;
