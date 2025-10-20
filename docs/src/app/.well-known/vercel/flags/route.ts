import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import * as flags from "../../../../../flags";

export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(flags));
