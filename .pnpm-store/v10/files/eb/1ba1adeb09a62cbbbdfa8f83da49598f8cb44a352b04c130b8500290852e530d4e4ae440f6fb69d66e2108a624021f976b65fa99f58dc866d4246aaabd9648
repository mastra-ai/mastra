import {
  splitByScope
} from "./chunk-3CN5LOSN.mjs";
import "./chunk-IEP6GGEX.mjs";

// src/jwtPayloadParser.ts
var parsePermissions = ({ per, fpm }) => {
  if (!per || !fpm) {
    return { permissions: [], featurePermissionMap: [] };
  }
  const permissions = per.split(",").map((p) => p.trim());
  const featurePermissionMap = fpm.split(",").map((permission) => Number.parseInt(permission.trim(), 10)).map(
    (permission) => permission.toString(2).padStart(permissions.length, "0").split("").map((bit) => Number.parseInt(bit, 10)).reverse()
  ).filter(Boolean);
  return { permissions, featurePermissionMap };
};
function buildOrgPermissions({
  features,
  permissions,
  featurePermissionMap
}) {
  if (!features || !permissions || !featurePermissionMap) {
    return [];
  }
  const orgPermissions = [];
  for (let featureIndex = 0; featureIndex < features.length; featureIndex++) {
    const feature = features[featureIndex];
    if (featureIndex >= featurePermissionMap.length) {
      continue;
    }
    const permissionBits = featurePermissionMap[featureIndex];
    if (!permissionBits) {
      continue;
    }
    for (let permIndex = 0; permIndex < permissionBits.length; permIndex++) {
      if (permissionBits[permIndex] === 1) {
        orgPermissions.push(`org:${feature}:${permissions[permIndex]}`);
      }
    }
  }
  return orgPermissions;
}
var __experimental_JWTPayloadToAuthObjectProperties = (claims) => {
  let orgId;
  let orgRole;
  let orgSlug;
  let orgPermissions;
  const factorVerificationAge = claims.fva ?? null;
  const sessionStatus = claims.sts ?? null;
  switch (claims.v) {
    case 2: {
      if (claims.o) {
        orgId = claims.o?.id;
        orgSlug = claims.o?.slg;
        if (claims.o?.rol) {
          orgRole = `org:${claims.o?.rol}`;
        }
        const { org } = splitByScope(claims.fea);
        const { permissions, featurePermissionMap } = parsePermissions({
          per: claims.o?.per,
          fpm: claims.o?.fpm
        });
        orgPermissions = buildOrgPermissions({
          features: org,
          featurePermissionMap,
          permissions
        });
      }
      break;
    }
    default:
      orgId = claims.org_id;
      orgRole = claims.org_role;
      orgSlug = claims.org_slug;
      orgPermissions = claims.org_permissions;
      break;
  }
  return {
    sessionClaims: claims,
    sessionId: claims.sid,
    sessionStatus,
    actor: claims.act,
    userId: claims.sub,
    orgId,
    orgRole,
    orgSlug,
    orgPermissions,
    factorVerificationAge
  };
};
export {
  __experimental_JWTPayloadToAuthObjectProperties,
  parsePermissions
};
//# sourceMappingURL=jwtPayloadParser.mjs.map