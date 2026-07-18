---
name: pvc-pending
description: Diagnostic checklist for Pods stuck Pending due to unbound PersistentVolumeClaims
version: 1.0.0
metadata:
  tags:
    - kubernetes
    - pod-failure
    - pending
    - pvc
---

# Pending / PVC-stuck

The Pod is stuck in `Pending` and never gets scheduled. This checklist covers the
storage-related cause specifically: an unbound `PersistentVolumeClaim` blocking the scheduler.
(A Pending Pod can also be stuck on plain resource scarcity or taints/tolerations — rule storage
in or out first via the events, since the fix is completely different.)

## Diagnostic Checklist

1. **Describe the Pod.** Confirm `status.phase == "Pending"` and check
   `status.conditions[].reason` for `Unschedulable`. Note every PVC referenced under
   `spec.volumes[].persistentVolumeClaim.claimName`.
2. **Fetch recent Events for the Pod.** The scheduler's `FailedScheduling` event message usually
   names the blocking PVC directly (e.g. `"pod has unbound immediate PersistentVolumeClaims"`).
   This confirms storage is the actual blocker before you spend time checking node capacity.
3. **Check each referenced PVC's status.** `resources_get` the PVC
   (`apiVersion: v1, kind: PersistentVolumeClaim`) and read `status.phase`:
   - `Pending` — no PersistentVolume has been bound yet. Check the reason under
     `status.conditions` or recent Events on the PVC itself (not just the Pod) —
     `ProvisioningFailed` events on the PVC carry the underlying error from the provisioner.
   - `Bound` — the PVC itself is fine; the Pod being Pending has a different cause (go back to
     step 2's event message and re-read it — this checklist doesn't apply).
4. **Check the PVC's StorageClass.** `resources_get`
   (`apiVersion: storage.k8s.io/v1, kind: StorageClass`) for `spec.storageClassName` referenced by
   the PVC (or the cluster's default StorageClass if the PVC didn't specify one — and check
   whether a default even exists, since "no default StorageClass and PVC didn't specify one" is
   itself a common root cause). Confirm the `provisioner` field names a driver that's actually
   installed/running in this cluster.
5. **If the StorageClass and provisioner look fine, check node capacity** for the specific
   scenario of a `WaitForFirstConsumer` binding mode with zonal/topology constraints: the PVC may
   be waiting for a Pod to be scheduled first to determine its zone, while the Pod is waiting for
   the PVC to bind first — a deadlock that shows up when the only nodes with capacity are in a
   different zone than where the storage can be provisioned. `resources_list`
   (`apiVersion: v1, kind: Node`) and check zone labels against the StorageClass's
   `allowedTopologies`, if set.

## Classification Rule

`rootCause` must name which layer failed: no PV available to bind (capacity/provisioner issue),
StorageClass misconfigured or missing, provisioner not running, or a topology/zone mismatch under
`WaitForFirstConsumer`. "PVC is pending" restates the symptom, not the cause.

## Confidence Guidance

- **High (0.8+):** PVC's own Events (not just the Pod's) show an explicit `ProvisioningFailed` or
  binding error message.
- **Medium (0.4–0.79):** PVC status and StorageClass config are consistent with a specific cause,
  but no explicit provisioner error message was retrievable.
- **Low (<0.4):** PVC is `Bound` and the Pending cause is something else entirely — say this
  explicitly rather than forcing a storage-shaped answer onto a non-storage problem.
