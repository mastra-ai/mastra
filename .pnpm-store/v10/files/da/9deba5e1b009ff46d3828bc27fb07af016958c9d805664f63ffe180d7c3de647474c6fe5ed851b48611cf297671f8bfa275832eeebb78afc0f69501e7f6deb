import "../../../index--CrC0_x3.mjs";
import "../../../types-CRiHq5rJ.mjs";
import "../../../helper-DU33OcfW.mjs";
import { c as Subset, t as AuthorizeResponse } from "../../../index-CNCxG_Zo.mjs";
import "../../../plugins-Brc8BsoZ.mjs";
import "../../../index-CBKo0Xhw.mjs";
import "../../../index-4Dl390uF.mjs";
import "../../../index-1CASa5wB.mjs";
import "../../../index-BMWasIyr.mjs";
import "../../../index-vNFlnKLV.mjs";
import "../../../index-CDpFwohl.mjs";
import "../../../index-lgP3EBx9.mjs";
import "../../../index-DZdJoFeD.mjs";
import "../../../index-DJB7f_aW.mjs";
import "../../../index-CKa7aJXf.mjs";
import "../../../index-By5ErUuO.mjs";
import "../../../index-Bxm_8jHm.mjs";
import "../../../index-LFDxx8ua.mjs";
import "../../../index-C_Em80Re.mjs";
import "../../../index-DPBufSCV.mjs";
import "../../../index-BxN7bJlj.mjs";
import "../../../index-C4DspCDn.mjs";
import "../../../index-CW2lwKn2.mjs";
import "../../../index-C3xObRkV.mjs";
import "../../../index-CTeF5TnP.mjs";

//#region src/plugins/admin/access/statement.d.ts
declare const defaultStatements: {
  readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
  readonly session: readonly ["list", "revoke", "delete"];
};
declare const defaultAc: {
  newRole<K extends "session" | "user">(statements: Subset<K, {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }>): {
    authorize<K_1 extends K>(request: K_1 extends infer T extends keyof Subset<K, {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }> ? { [key in T]?: Subset<K, {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>[key] | {
      actions: Subset<K, {
        readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
        readonly session: readonly ["list", "revoke", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<K, {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>;
  };
  statements: {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  };
};
declare const adminAc: {
  authorize<K extends "session" | "user">(request: K extends infer T extends keyof Subset<"session" | "user", {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }> ? { [key in T]?: Subset<"session" | "user", {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }>[key] | {
    actions: Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>[key];
    connector: "OR" | "AND";
  } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
  statements: Subset<"session" | "user", {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }>;
};
declare const userAc: {
  authorize<K extends "session" | "user">(request: K extends infer T extends keyof Subset<"session" | "user", {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }> ? { [key in T]?: Subset<"session" | "user", {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }>[key] | {
    actions: Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>[key];
    connector: "OR" | "AND";
  } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
  statements: Subset<"session" | "user", {
    readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
    readonly session: readonly ["list", "revoke", "delete"];
  }>;
};
declare const defaultRoles: {
  admin: {
    authorize<K extends "session" | "user">(request: K extends infer T extends keyof Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }> ? { [key in T]?: Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>[key] | {
      actions: Subset<"session" | "user", {
        readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
        readonly session: readonly ["list", "revoke", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>;
  };
  user: {
    authorize<K extends "session" | "user">(request: K extends infer T extends keyof Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }> ? { [key in T]?: Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>[key] | {
      actions: Subset<"session" | "user", {
        readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
        readonly session: readonly ["list", "revoke", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<"session" | "user", {
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>;
  };
};
//#endregion
export { adminAc, defaultAc, defaultRoles, defaultStatements, userAc };