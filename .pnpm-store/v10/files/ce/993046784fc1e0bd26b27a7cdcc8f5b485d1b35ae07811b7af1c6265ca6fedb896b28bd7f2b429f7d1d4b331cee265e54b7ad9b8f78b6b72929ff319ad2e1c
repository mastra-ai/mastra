"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var get_env_exports = {};
__export(get_env_exports, {
  getEnv: () => getEnv
});
module.exports = __toCommonJS(get_env_exports);
const getEnv = (env = process.env) => ({
  /**
   * An indicator to show that System Environment Variables have been exposed to your project's Deployments.
   * @example "1"
   */
  VERCEL: get(env, "VERCEL"),
  /**
   * An indicator that the code is running in a Continuous Integration environment.
   * @example "1"
   */
  CI: get(env, "CI"),
  /**
   * The Environment that the app is deployed and running on.
   * @example "production"
   */
  VERCEL_ENV: get(env, "VERCEL_ENV"),
  /**
   * The domain name of the generated deployment URL. The value does not include the protocol scheme https://.
   * NOTE: This Variable cannot be used in conjunction with Standard Deployment Protection.
   * @example "*.vercel.app"
   */
  VERCEL_URL: get(env, "VERCEL_URL"),
  /**
   * The domain name of the generated Git branch URL. The value does not include the protocol scheme https://.
   * @example "*-git-*.vercel.app"
   */
  VERCEL_BRANCH_URL: get(env, "VERCEL_BRANCH_URL"),
  /**
   * A production domain name of the project. This is useful to reliably generate links that point to production such as OG-image URLs.
   * The value does not include the protocol scheme https://.
   * @example "myproject.vercel.app"
   */
  VERCEL_PROJECT_PRODUCTION_URL: get(env, "VERCEL_PROJECT_PRODUCTION_URL"),
  /**
   * The ID of the Region where the app is running.
   *
   * Possible values:
   * - arn1 (Stockholm, Sweden)
   * - bom1 (Mumbai, India)
   * - cdg1 (Paris, France)
   * - cle1 (Cleveland, USA)
   * - cpt1 (Cape Town, South Africa)
   * - dub1 (Dublin, Ireland)
   * - fra1 (Frankfurt, Germany)
   * - gru1 (São Paulo, Brazil)
   * - hkg1 (Hong Kong)
   * - hnd1 (Tokyo, Japan)
   * - iad1 (Washington, D.C., USA)
   * - icn1 (Seoul, South Korea)
   * - kix1 (Osaka, Japan)
   * - lhr1 (London, United Kingdom)
   * - pdx1 (Portland, USA)
   * - sfo1 (San Francisco, USA)
   * - sin1 (Singapore)
   * - syd1 (Sydney, Australia)
   * - dev1 (Development Region)
   *
   * @example "iad1"
   */
  VERCEL_REGION: get(env, "VERCEL_REGION"),
  /**
   * The unique identifier for the deployment, which can be used to implement Skew Protection.
   * @example "dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3"
   */
  VERCEL_DEPLOYMENT_ID: get(env, "VERCEL_DEPLOYMENT_ID"),
  /**
   * When Skew Protection is enabled in Project Settings, this value is set to 1.
   * @example "1"
   */
  VERCEL_SKEW_PROTECTION_ENABLED: get(env, "VERCEL_SKEW_PROTECTION_ENABLED"),
  /**
   * The Protection Bypass for Automation value, if the secret has been generated in the project's Deployment Protection settings.
   */
  VERCEL_AUTOMATION_BYPASS_SECRET: get(env, "VERCEL_AUTOMATION_BYPASS_SECRET"),
  /**
   * The Git Provider the deployment is triggered from.
   * @example "github"
   */
  VERCEL_GIT_PROVIDER: get(env, "VERCEL_GIT_PROVIDER"),
  /**
   * The origin repository the deployment is triggered from.
   * @example "my-site"
   */
  VERCEL_GIT_REPO_SLUG: get(env, "VERCEL_GIT_REPO_SLUG"),
  /**
   * The account that owns the repository the deployment is triggered from.
   * @example "acme"
   */
  VERCEL_GIT_REPO_OWNER: get(env, "VERCEL_GIT_REPO_OWNER"),
  /**
   * The ID of the repository the deployment is triggered from.
   * @example "117716146"
   */
  VERCEL_GIT_REPO_ID: get(env, "VERCEL_GIT_REPO_ID"),
  /**
   * The git branch of the commit the deployment was triggered by.
   * @example "improve-about-page"
   */
  VERCEL_GIT_COMMIT_REF: get(env, "VERCEL_GIT_COMMIT_REF"),
  /**
   * The git SHA of the commit the deployment was triggered by.
   * @example "fa1eade47b73733d6312d5abfad33ce9e4068081"
   */
  VERCEL_GIT_COMMIT_SHA: get(env, "VERCEL_GIT_COMMIT_SHA"),
  /**
   * The message attached to the commit the deployment was triggered by.
   * @example "Update about page"
   */
  VERCEL_GIT_COMMIT_MESSAGE: get(env, "VERCEL_GIT_COMMIT_MESSAGE"),
  /**
   * The username attached to the author of the commit that the project was deployed by.
   * @example "johndoe"
   */
  VERCEL_GIT_COMMIT_AUTHOR_LOGIN: get(env, "VERCEL_GIT_COMMIT_AUTHOR_LOGIN"),
  /**
   * The name attached to the author of the commit that the project was deployed by.
   * @example "John Doe"
   */
  VERCEL_GIT_COMMIT_AUTHOR_NAME: get(env, "VERCEL_GIT_COMMIT_AUTHOR_NAME"),
  /**
   * The git SHA of the last successful deployment for the project and branch.
   * NOTE: This Variable is only exposed when an Ignored Build Step is provided.
   * @example "fa1eade47b73733d6312d5abfad33ce9e4068080"
   */
  VERCEL_GIT_PREVIOUS_SHA: get(env, "VERCEL_GIT_PREVIOUS_SHA"),
  /**
   * The pull request id the deployment was triggered by. If a deployment is created on a branch before a pull request is made, this value will be an empty string.
   * @example "23"
   */
  VERCEL_GIT_PULL_REQUEST_ID: get(env, "VERCEL_GIT_PULL_REQUEST_ID")
});
const get = (env, key) => {
  const value = env[key];
  return value === "" ? void 0 : value;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getEnv
});
