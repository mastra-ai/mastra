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

// src/jwtPayloadParser.ts
var jwtPayloadParser_exports = {};
__export(jwtPayloadParser_exports, {
  __experimental_JWTPayloadToAuthObjectProperties: () => __experimental_JWTPayloadToAuthObjectProperties,
  parsePermissions: () => parsePermissions
});
module.exports = __toCommonJS(jwtPayloadParser_exports);

// src/authorization.ts
var splitByScope = (fea) => {
  const features = fea ? fea.split(",").map((f) => f.trim()) : [];
  return {
    org: features.filter((f) => f.split(":")[0].includes("o")).map((f) => f.split(":")[1]),
    user: features.filter((f) => f.split(":")[0].includes("u")).map((f) => f.split(":")[1])
  };
};

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  __experimental_JWTPayloadToAuthObjectProperties,
  parsePermissions
});
//# sourceMappingURL=jwtPayloadParser.js.map