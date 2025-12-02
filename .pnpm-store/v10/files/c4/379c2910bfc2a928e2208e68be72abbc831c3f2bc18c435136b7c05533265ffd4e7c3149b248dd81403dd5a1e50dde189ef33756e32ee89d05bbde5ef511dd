import { isValidHostLabel } from "@smithy/util-endpoints";
const validRegions = new Set();
export const checkRegion = (region, check = isValidHostLabel) => {
    if (!validRegions.has(region) && !check(region)) {
        throw new Error(`Region not accepted: region="${region}" is not a valid hostname component.`);
    }
    else {
        validRegions.add(region);
    }
};
