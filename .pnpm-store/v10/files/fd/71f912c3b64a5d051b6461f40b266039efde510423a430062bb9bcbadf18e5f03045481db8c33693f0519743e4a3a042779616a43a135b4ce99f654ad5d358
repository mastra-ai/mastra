import assembleReleasePlan from "@changesets/assemble-release-plan";
import readChangesets from "@changesets/read";
import { read } from "@changesets/config";
import { Config, ReleasePlan } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { readPreState } from "@changesets/pre";

export default async function getReleasePlan(
  cwd: string,
  sinceRef?: string,
  passedConfig?: Config
): Promise<ReleasePlan> {
  const packages = await getPackages(cwd);
  const preState = await readPreState(cwd);
  const readConfig = await read(cwd, packages);
  const config = passedConfig ? { ...readConfig, ...passedConfig } : readConfig;
  const changesets = await readChangesets(cwd, sinceRef);

  return assembleReleasePlan(changesets, packages, config, preState);
}
