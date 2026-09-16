import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseDetail } from "@/components/admin/case-detail";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonitoringSection } from "@/components/admin/monitoring-section";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import {
  approveCase,
  clearSession,
  getManualResolutionContext,
  hasAnyRole,
  listCases,
  rejectCase,
  resolveManually,
  reindexKnowledge,
  SessionExpiredError,
  type SupportSession,
  type ManualResolutionContext,
} from "@/lib/api";
import { useMountedSession } from "@/lib/mounted-session";
import { SessionLogin } from "@/components/session-login";
import type { SupportCase } from "@/lib/types";
import { Ellipsis, RefreshCcw, XIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { isCurrentManualContextSelection } from "./admin-manual-context";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "In progress" },
  { value: "waiting_approval", label: "Waiting approval" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
] as const;

const ADMIN_VIEWS = ["cases", "monitoring", "telemetry"] as const;
type AdminView = (typeof ADMIN_VIEWS)[number];

export function Admin() {
  const { session, setSession, invalidateSession } = useMountedSession();
  if (!session)
    return (
      <SessionLogin
        email="approver@local.test"
        password="local-approver"
        onSession={setSession}
      />
    );
  if (!hasAnyRole(session, ["support-agent", "approver", "admin"]))
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">
          This session cannot access the support queue.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            clearSession(session);
            setSession(undefined);
          }}
        >
          Switch account
        </Button>
      </div>
    );

  return (
    <AdminSession
      key={session.token}
      session={session}
      onSessionExpired={invalidateSession}
      onSignOut={() => {
        clearSession(session);
        setSession(undefined);
      }}
    />
  );
}

function AdminSession({
  session,
  onSignOut,
  onSessionExpired,
}: {
  session: SupportSession;
  onSignOut: () => void;
  onSessionExpired: (session: SupportSession) => void;
}) {
  const mounted = useRef(true);
  const { caseId } = useParams<{ caseId?: string }>();
  const navigate = useNavigate();

  const [cases, setCases] = useState<SupportCase[]>([]);
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]["value"]>("all");
  const [activeView, setActiveView] = useState<AdminView>("cases");
  const [reindexing, setReindexing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualContext, setManualContext] = useState<ManualResolutionContext>();
  // Every async manual-resolution result is scoped to the modal selection
  // which created it. Route changes invalidate both POST and 409 refreshes.
  const manualSelectionGeneration = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await listCases(session);
      if (!mounted.current) return;
      setCases(res.cases);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        onSessionExpired(session);
        return;
      }
      if (mounted.current)
        toast.error(
          error instanceof Error ? error.message : "Failed to load cases",
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [session, onSessionExpired]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredCases = useMemo(() => {
    switch (filter) {
      case "active":
        return cases.filter(
          (c) => c.status === "new" || c.status === "processing",
        );
      case "waiting_approval":
      case "escalated":
      case "resolved":
        return cases.filter((c) => c.status === filter);
      default:
        return cases;
    }
  }, [cases, filter]);

  const selectedCase = cases.find((c) => c.id === caseId);
  const selectedCaseId = selectedCase?.id;
  const selectedCaseStatus = selectedCase?.status;
  const isAdmin = session.principal.roles.includes("admin");
  // The URL is authoritative for a selected case, including browser history.
  // Keep the prior non-case tab in state so Forward restores it after closing.
  const renderedView: AdminView = caseId ? "cases" : activeView;

  useEffect(() => {
    manualSelectionGeneration.current += 1;
    setManualContext(undefined);
  }, [caseId]);

  useEffect(() => {
    let stale = false;
    if (
      !selectedCaseId ||
      !selectedCaseStatus ||
      !["escalated", "resolved"].includes(selectedCaseStatus)
    ) {
      setManualContext(undefined);
      return () => {
        stale = true;
      };
    }
    getManualResolutionContext(selectedCaseId, session)
      .then((context) => {
        if (mounted.current && !stale) setManualContext(context);
      })
      .catch((error) => {
        if (!stale && error instanceof SessionExpiredError)
          onSessionExpired(session);
      });
    return () => {
      stale = true;
    };
  }, [
    selectedCase,
    selectedCaseId,
    selectedCaseStatus,
    session,
    onSessionExpired,
  ]);

  async function handleReindex() {
    setReindexing(true);
    try {
      const result = await reindexKnowledge(session);
      if (!mounted.current) return;
      toast.success(`Indexed ${result.indexed} policy chunks`);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        onSessionExpired(session);
        return;
      }
      if (mounted.current)
        toast.error(error instanceof Error ? error.message : "Reindex failed");
    } finally {
      if (mounted.current) setReindexing(false);
    }
  }

  async function handleDecision(
    approved: boolean,
    commandFingerprint: string,
    note?: string,
    serviceProblemConfirmed?: true,
  ) {
    if (!selectedCase) return;
    try {
      const updated = approved
        ? await approveCase(
            selectedCase.id,
            commandFingerprint,
            note,
            session,
            serviceProblemConfirmed,
          )
        : await rejectCase(selectedCase.id, commandFingerprint, note, session);
      if (!mounted.current) return;
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(
        approved ? "Refund approved" : "Refund rejected and case escalated",
      );
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        onSessionExpired(session);
        return;
      }
      if (mounted.current)
        toast.error(
          error instanceof Error ? error.message : "Failed to submit decision",
        );
    }
  }

  async function handleManualResolution(note: string, idempotencyKey: string) {
    if (!selectedCase || !manualContext?.activeTurnId) return;
    const submittedCaseId = selectedCase.id;
    const submittedGeneration = manualSelectionGeneration.current;
    const submittedContext = manualContext;
    const submittedTurnId = manualContext.activeTurnId;
    const selectionIsCurrent = () =>
      mounted.current &&
      isCurrentManualContextSelection(
        { caseId, generation: manualSelectionGeneration.current },
        { caseId: submittedCaseId, generation: submittedGeneration },
      );
    try {
      const result = await resolveManually(
        submittedCaseId,
        {
          expectedVersion: submittedContext.version,
          expectedTurnId: submittedTurnId,
          idempotencyKey,
          internalNote: note,
        },
        session,
      );
      if (!selectionIsCurrent()) return;
      setCases((previous) =>
        previous.map((item) =>
          item.id === result.case.id ? result.case : item,
        ),
      );
      setManualContext(result.context);
      toast.success(
        result.replayed
          ? "Manual close already recorded"
          : "Internal note recorded and close queued",
      );
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        onSessionExpired(session);
        return;
      }
      if (selectionIsCurrent())
        toast.error(
          error instanceof Error ? error.message : "Manual resolution failed",
        );
      // A 409 can be caused by a follow-up. Reload the immutable context before
      // allowing the same human to make a deliberate new decision.
      if (selectionIsCurrent())
        getManualResolutionContext(submittedCaseId, session)
          .then((context) => {
            if (selectionIsCurrent()) setManualContext(context);
          })
          .catch(() => undefined);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Support admin
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Review cases and their supporting evidence.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="More admin actions"
              />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-fit min-w-0">
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                Signed in as {session.principal.email}
              </DropdownMenuItem>
              {session.principal.roles.includes("admin") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleReindex}
                    disabled={reindexing}
                  >
                    {reindexing ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCcw data-icon="inline-start" />
                    )}
                    Reindex knowledge
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  onSignOut();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      <Tabs
        value={renderedView}
        onValueChange={(value) => setActiveView(value as AdminView)}
      >
        <TabsList aria-label="Admin sections" className="h-auto flex-wrap">
          <TabsTrigger value="cases">Cases</TabsTrigger>
          {isAdmin && <TabsTrigger value="monitoring">Monitoring</TabsTrigger>}
          {isAdmin && <TabsTrigger value="telemetry">Telemetry</TabsTrigger>}
        </TabsList>

        <TabsContent value="cases" className="mt-6">
          <section className="flex flex-col gap-6">
            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>Case queue</CardTitle>
                  <CardDescription>
                    Filter the list and open a case.
                  </CardDescription>
                </div>
                <Tabs
                  value={filter}
                  onValueChange={(v) => setFilter(v as typeof filter)}
                >
                  <TabsList className="h-auto flex-wrap">
                    {FILTERS.map((f) => (
                      <TabsTrigger
                        key={f.value}
                        value={f.value}
                        className="text-xs"
                      >
                        {f.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {loading && (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                )}
                {!loading && filteredCases.length === 0 && (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyTitle>No cases in this view</EmptyTitle>
                      <EmptyDescription>Try another filter.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                {!loading && filteredCases.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCases.map((c) => (
                        <TableRow
                          key={c.id}
                          data-state={c.id === caseId ? "selected" : undefined}
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/${c.id}`)}
                        >
                          <TableCell>
                            <button
                              type="button"
                              className="flex flex-col text-left"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/admin/${c.id}`);
                              }}
                            >
                              <span className="font-medium">{c.subject}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.id}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={c.status} />
                          </TableCell>
                          <TableCell>
                            {c.customer.name ?? c.customer.email}
                          </TableCell>
                          <TableCell>
                            {new Date(c.updatedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={Boolean(renderedView === "cases" && caseId && selectedCase)}
              onOpenChange={(open) => !open && navigate("/admin")}
            >
              {selectedCase && (
                <DialogContent
                  showCloseButton={false}
                  className="max-h-[85vh] sm:max-w-4xl overflow-y-auto"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <DialogHeader className="min-w-0 gap-1 sm:pr-3">
                      <DialogTitle className="break-all">
                        Support Case: {selectedCase.id}
                      </DialogTitle>
                      <p className="break-all text-sm text-muted-foreground">
                        {selectedCase.customer.name ??
                          selectedCase.customer.email ??
                          "Customer"}
                        {selectedCase.customer.name &&
                        selectedCase.customer.email
                          ? ` <${selectedCase.customer.email}>`
                          : ""}{" "}
                        · via {selectedCase.source}
                      </p>
                    </DialogHeader>
                    <div className="flex items-start justify-end gap-1.5 sm:shrink-0">
                      <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                        <StatusBadge status={selectedCase.status} />
                        {selectedCase.triage && (
                          <>
                            <Badge variant="secondary" className="capitalize">
                              {selectedCase.triage.intent.replace(/_/g, " ")}
                            </Badge>
                            <UrgencyBadge
                              urgency={selectedCase.triage.urgency}
                            />
                          </>
                        )}
                      </div>
                      <DialogClose
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close"
                          />
                        }
                      >
                        <XIcon />
                        <span className="sr-only">Close</span>
                      </DialogClose>
                    </div>
                  </div>
                  <CaseDetail
                    supportCase={selectedCase}
                    approverId={session.principal.id}
                    onDecision={handleDecision}
                    canApprove={hasAnyRole(session, ["approver", "admin"])}
                    manualResolution={manualContext}
                    onManualResolution={handleManualResolution}
                  />
                </DialogContent>
              )}
            </Dialog>
          </section>
        </TabsContent>

        {isAdmin && renderedView !== "cases" && (
          <TabsContent value={renderedView} className="mt-6">
            <MonitoringSection session={session} view={renderedView} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
