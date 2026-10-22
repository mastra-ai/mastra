"use client";
import WorkspaceClient from "../../../src/ui/workspace.tsx";
import { components } from "../../../src/components/catalog.ts";
import { renderers } from "../../../src/ui/renderers.tsx";
import { compact } from "../../fixtures/compact.ts";
import { CompactMetric } from "../../fixtures/compact-view.tsx";

// Extend the real client registries only in this isolated browser-test application.
// The guards keep development hot reload from registering the same ID twice.
if (!components.some((entry) => entry.id === compact.id))
  Array.prototype.push.call(components, compact);
if (!renderers.some((entry) => entry.declaration.id === compact.id))
  renderers.push({ declaration: compact, render: CompactMetric });

export default WorkspaceClient;
