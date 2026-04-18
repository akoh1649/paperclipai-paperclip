import type {
  IssueBackedMissionSummary,
  MissionFindingProjection,
  MissionFindingSeverity,
  MissionFindingStatus,
  MissionMilestoneProjection,
  MissionSummaryIssue,
} from "@paperclipai/shared";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  FileCheck2,
  Flag,
  GitBranch,
  ListChecks,
  Pause,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Square,
  Table2,
  XCircle,
} from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { createIssueDetailPath } from "@/lib/issueDetailBreadcrumb";
import { cn } from "@/lib/utils";

export type MissionPanelAction = "init" | "decompose" | "advance" | "pause" | "resume" | "cancel" | "requestApproval";

type MissionSummaryPanelProps = {
  summary?: IssueBackedMissionSummary | null;
  isLoading?: boolean;
  error?: Error | null;
  issueStatus?: MissionSummaryIssue["status"] | null;
  pendingAction?: MissionPanelAction | null;
  actionError?: string | null;
  onAction?: (action: MissionPanelAction) => void;
  onWaiveFinding?: (findingId: string, rationale: string) => void;
  pendingWaiveFindingId?: string | null;
};

const stateLabels: Record<IssueBackedMissionSummary["state"], string> = {
  draft: "Draft",
  planning: "Planning",
  ready_for_approval: "Ready for approval",
  running: "Running",
  validating: "Validating",
  fixing: "Fixing",
  blocked: "Blocked",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatCost(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatTokens(inputTokens: number, outputTokens: number) {
  const total = inputTokens + outputTokens;
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
  return formatInteger(total);
}

function statusTone(status: MissionSummaryIssue["status"]) {
  if (status === "done") return "text-emerald-600 dark:text-emerald-400";
  if (status === "blocked") return "text-amber-700 dark:text-amber-300";
  if (status === "cancelled") return "text-muted-foreground";
  if (status === "in_progress" || status === "in_review") return "text-cyan-700 dark:text-cyan-300";
  return "text-foreground";
}

function issueLabel(issue: Pick<MissionSummaryIssue, "identifier" | "title">) {
  return issue.identifier ? `${issue.identifier} ${issue.title}` : issue.title;
}

function issueKey(issue: Pick<MissionSummaryIssue, "id" | "originId" | "identifier">) {
  const parts = issue.originId?.split(":") ?? [];
  return parts.at(-1) || issue.identifier || issue.id.slice(0, 8);
}

function severityLabel(severity: MissionFindingSeverity) {
  if (severity === "non_blocking") return "Non-blocking";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function roleLabel(role: string) {
  if (role === "scrutiny_validator") return "Scrutiny";
  if (role === "user_testing_validator") return "User testing";
  return role.replaceAll("_", " ");
}

function findingStatusLabel(status: MissionFindingStatus) {
  if (status === "fix_created") return "Fix created";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function findingStatusTone(status: MissionFindingStatus) {
  if (status === "resolved") return "text-emerald-700 dark:text-emerald-300";
  if (status === "waived") return "text-muted-foreground";
  if (status === "fix_created") return "text-cyan-700 dark:text-cyan-300";
  return "text-amber-700 dark:text-amber-300";
}

function IssuePill({ issue }: { issue: MissionSummaryIssue }) {
  return (
    <Link
      to={createIssueDetailPath(issue.identifier ?? issue.id)}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent/50"
      title={issueLabel(issue)}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-current", statusTone(issue.status))} />
      <span className="truncate">{issue.identifier ?? issue.id.slice(0, 8)}</span>
      <span className="text-muted-foreground">{issue.status.replace("_", " ")}</span>
    </Link>
  );
}

function MetricBand({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Route;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="min-w-0 border-l border-border pl-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
      {detail ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

function MissionActionButton({
  action,
  label,
  icon: Icon,
  pendingAction,
  disabled,
  onAction,
  variant = "outline",
}: {
  action: MissionPanelAction;
  label: string;
  icon: typeof Route;
  pendingAction: MissionPanelAction | null | undefined;
  disabled?: boolean;
  onAction?: (action: MissionPanelAction) => void;
  variant?: "default" | "outline" | "secondary" | "destructive";
}) {
  const isPending = pendingAction === action;
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className="min-w-0 shrink-0 shadow-none"
      disabled={!onAction || disabled || Boolean(pendingAction)}
      onClick={() => onAction?.(action)}
    >
      <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{isPending ? "Working" : label}</span>
    </Button>
  );
}

function EvidenceLink({ value }: { value: string }) {
  const isLink = /^https?:\/\//.test(value) || value.startsWith("/");
  if (!isLink) return <span className="break-words">{value}</span>;
  return (
    <a className="break-words text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300" href={value}>
      {value}
    </a>
  );
}

function MilestoneWaterfall({ milestones }: { milestones: MissionMilestoneProjection[] }) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
        No milestone issues yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {milestones.map((milestone, index) => {
        const totalWork = milestone.features.length + milestone.validations.length + milestone.fixLoops.length;
        const doneWork = [...milestone.features, ...milestone.validations, ...milestone.fixLoops].filter(
          (issue) => issue.status === "done",
        ).length;
        const progress = totalWork > 0 ? Math.round((doneWork / totalWork) * 100) : 0;
        return (
          <div key={milestone.key} className="grid gap-2 rounded-md border border-border bg-background/50 p-3 sm:grid-cols-[28px_minmax(0,1fr)_auto]">
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs font-medium">
                {index + 1}
              </div>
              {index < milestones.length - 1 ? <div className="mt-1 h-full min-h-8 w-px bg-border" /> : null}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{milestone.title}</span>
                {milestone.issue ? <IssuePill issue={milestone.issue} /> : null}
              </div>
              {milestone.summary ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{milestone.summary}</p> : null}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    milestone.blockers.length > 0 ? "bg-amber-500" : progress === 100 ? "bg-emerald-500" : "bg-cyan-500",
                  )}
                  style={{ width: `${Math.max(6, progress)}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{milestone.features.length} features</span>
                <span>{milestone.validations.length} validations</span>
                <span>{milestone.fixLoops.length} fix loops</span>
                {milestone.blockers.length > 0 ? (
                  <span className="text-amber-700 dark:text-amber-300">{milestone.blockers.length} blocked</span>
                ) : null}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="text-sm font-semibold text-foreground">{progress}%</div>
              <div>{doneWork}/{totalWork || 0} done</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MissionSummaryPanel({
  summary,
  isLoading = false,
  error = null,
  issueStatus = null,
  pendingAction = null,
  actionError = null,
  onAction,
  onWaiveFinding,
  pendingWaiveFindingId = null,
}: MissionSummaryPanelProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-16 rounded-md bg-muted/70" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <h3 className="font-medium">Mission summary unavailable</h3>
            <p className="mt-1 text-destructive/80">{error.message || "The mission summary could not be loaded."}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!summary) return null;

  const completedDocuments = summary.documentChecklist.filter((item) => item.present).length;
  const totalFeatureCount = summary.milestones.reduce((total, milestone) => total + milestone.features.length, 0);
  const openMilestoneCount = summary.milestones.filter((milestone) => milestone.issue?.status !== "done").length;
  const activeWork = summary.activeWork.slice(0, 6);
  const allFeatures = summary.milestones.flatMap((milestone) =>
    milestone.features.map((feature) => ({ milestone, feature })),
  );
  const findingsBySeverity = summary.validationSummary.findings.reduce(
    (acc, finding) => {
      acc[finding.severity].push(finding);
      return acc;
    },
    { blocking: [], non_blocking: [], suggestion: [] } as Record<MissionFindingSeverity, MissionFindingProjection[]>,
  );
  const hasBlockingState = summary.state === "blocked" || summary.validationSummary.openBlockingFindingCount > 0;
  const hasGeneratedWork = totalFeatureCount + summary.milestones.reduce((total, milestone) =>
    total + milestone.validations.length + milestone.fixLoops.length, 0) > 0;
  const canUsePlanningActions = summary.documentErrors.length === 0 && summary.missing_required_document_keys.length === 0;
  const canPause = issueStatus !== "blocked" && issueStatus !== "done" && issueStatus !== "cancelled";
  const canResume = issueStatus === "blocked";
  const canCancel = issueStatus !== "done" && issueStatus !== "cancelled";

  function handleWaive(finding: MissionFindingProjection) {
    if (!onWaiveFinding) return;
    const rationale = window.prompt(`Waive ${finding.id}`, finding.recommended_fix_scope ?? "");
    if (rationale?.trim()) onWaiveFinding(finding.id, rationale.trim());
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Route className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Mission summary
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{summary.next_action}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
            summary.state === "blocked"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
          )}
        >
          {summary.state === "blocked" ? <Ban className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
          {stateLabels[summary.state]}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MissionActionButton
          action="advance"
          label="Advance"
          icon={ArrowRight}
          pendingAction={pendingAction}
          disabled={!canUsePlanningActions}
          onAction={onAction}
          variant="default"
        />
        <MissionActionButton
          action="decompose"
          label={hasGeneratedWork ? "Sync plan" : "Decompose"}
          icon={GitBranch}
          pendingAction={pendingAction}
          disabled={!canUsePlanningActions}
          onAction={onAction}
        />
        <MissionActionButton
          action="requestApproval"
          label="Approval"
          icon={ShieldCheck}
          pendingAction={pendingAction}
          onAction={onAction}
        />
        {canResume ? (
          <MissionActionButton action="resume" label="Resume" icon={Play} pendingAction={pendingAction} onAction={onAction} />
        ) : (
          <MissionActionButton action="pause" label="Pause" icon={Pause} pendingAction={pendingAction} disabled={!canPause} onAction={onAction} />
        )}
        <MissionActionButton
          action="cancel"
          label="Cancel"
          icon={XCircle}
          pendingAction={pendingAction}
          disabled={!canCancel}
          onAction={onAction}
          variant="destructive"
        />
      </div>

      {actionError && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricBand icon={FileCheck2} label="Documents" value={`${completedDocuments}/${summary.documentChecklist.length}`} />
        <MetricBand icon={ListChecks} label="Open milestones" value={openMilestoneCount} />
        <MetricBand icon={Flag} label="Features" value={totalFeatureCount} />
        <MetricBand icon={Clock3} label="Runs" value={`${summary.runSummary.active}/${summary.runSummary.total}`} detail={summary.runSummary.latestRunStatus ?? undefined} />
        <MetricBand icon={Sparkles} label="Findings" value={summary.validationSummary.counts.total} detail={`${summary.validationSummary.openBlockingFindingCount} blocking open`} />
        <MetricBand icon={FileText} label="Cost" value={formatCost(summary.costSummary.costCents)} detail={`${formatTokens(summary.costSummary.inputTokens, summary.costSummary.outputTokens)} tokens`} />
      </div>

      {summary.documentErrors.length > 0 && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Document errors
          </div>
          <ul className="mt-2 space-y-1">
            {summary.documentErrors.map((item) => (
              <li key={item.key}>
                <span className="font-mono">{item.key}</span>: {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasBlockingState && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Blocking attention required
          </div>
          <p className="mt-1 text-xs">
            {summary.blockers.length > 0
              ? `${summary.blockers.length} issue blocker relation${summary.blockers.length === 1 ? "" : "s"} remain unresolved.`
              : `${summary.validationSummary.openBlockingFindingCount} blocking validation finding${summary.validationSummary.openBlockingFindingCount === 1 ? "" : "s"} remain open.`}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Route className="h-3.5 w-3.5" />
            Milestone waterfall
          </h4>
          <MilestoneWaterfall milestones={summary.milestones} />
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document checklist</h4>
            <div className="mt-2 grid gap-1.5">
              {summary.documentChecklist.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-sm">
                  {item.present ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn("truncate", !item.present && "text-muted-foreground")}>{item.key}</span>
                </div>
              ))}
            </div>
          </div>

          {summary.blockers.length > 0 && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blockers</h4>
              <div className="mt-2 space-y-2">
                {summary.blockers.slice(0, 4).map((item) => (
                  <div key={item.issue.id} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                    <IssuePill issue={item.issue} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      Waiting on {item.blockers.map((blocker) => blocker.identifier ?? blocker.id.slice(0, 8)).join(", ") || "unresolved state"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeWork.length > 0 && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active work</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeWork.map((issue) => <IssuePill key={issue.id} issue={issue} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Table2 className="h-3.5 w-3.5" />
            Feature / assertion matrix
          </h4>
          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[minmax(150px,1fr)_120px_120px] bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Feature</span>
              <span>Status</span>
              <span>Milestone</span>
            </div>
            {allFeatures.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">No feature issues generated yet</div>
            ) : (
              allFeatures.slice(0, 8).map(({ feature, milestone }) => (
                <div key={feature.id} className="grid grid-cols-[minmax(150px,1fr)_120px_120px] gap-2 border-t border-border px-3 py-2 text-sm">
                  <Link to={createIssueDetailPath(feature.identifier ?? feature.id)} className="min-w-0 truncate hover:underline">
                    {issueKey(feature)}
                    <span className="ml-2 text-muted-foreground">{feature.title.replace(/^Mission feature:\s*/i, "")}</span>
                  </Link>
                  <span className={cn("truncate", statusTone(feature.status))}>{feature.status.replace("_", " ")}</span>
                  <span className="truncate text-muted-foreground" title={milestone.title}>{milestone.key}</span>
                </div>
              ))
            )}
          </div>
          {summary.validationSummary.assertions.length > 0 && (
            <div className="grid gap-2">
              {summary.validationSummary.assertions.slice(0, 6).map((assertion) => (
                <div key={assertion.assertion_id} className="rounded-md border border-border bg-background/50 p-3 text-sm">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{assertion.assertion_id}</span>
                    <span className="text-xs text-muted-foreground">{assertion.findingIds.length} findings</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="text-amber-700 dark:text-amber-300">{assertion.severity.blocking} blocking</span>
                    <span className="text-muted-foreground">{assertion.severity.non_blocking} non-blocking</span>
                    <span className="text-muted-foreground">{assertion.severity.suggestion} suggestions</span>
                    <span className="text-cyan-700 dark:text-cyan-300">{assertion.statuses.fix_created} fixes</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Validation rounds
          </h4>
          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[72px_minmax(120px,1fr)_96px] bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Round</span>
              <span>Validator</span>
              <span>Findings</span>
            </div>
            {summary.validationSummary.reports.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">No validation reports yet</div>
            ) : (
              summary.validationSummary.reports.map((report) => (
                <div key={report.documentKey} className="grid grid-cols-[72px_minmax(120px,1fr)_96px] gap-2 border-t border-border px-3 py-2 text-sm">
                  <span>{report.round}</span>
                  <span className="min-w-0 truncate">{roleLabel(report.validator_role)}</span>
                  <span className={report.findings.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                    {report.findings.length}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          Findings board
        </h4>
        <div className="grid gap-3 lg:grid-cols-3">
          {(["blocking", "non_blocking", "suggestion"] as const).map((severity) => (
            <div key={severity} className="min-w-0 rounded-md border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <h5 className="truncate text-sm font-medium">{severityLabel(severity)}</h5>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {findingsBySeverity[severity].length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {findingsBySeverity[severity].length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground">
                    No findings
                  </div>
                ) : (
                  findingsBySeverity[severity].map((finding) => (
                    <div key={finding.id} className="rounded-md border border-border bg-card p-3 text-xs">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{finding.title}</div>
                          <div className="mt-1 font-mono text-muted-foreground">{finding.id}</div>
                        </div>
                        <span className={cn("shrink-0", findingStatusTone(finding.computedStatus))}>
                          {findingStatusLabel(finding.computedStatus)}
                        </span>
                      </div>
                      {finding.assertion_id ? (
                        <div className="mt-2 truncate text-muted-foreground">Assertion {finding.assertion_id}</div>
                      ) : null}
                      {finding.fixIssue ? (
                        <div className="mt-2">
                          <IssuePill issue={finding.fixIssue} />
                        </div>
                      ) : null}
                      {finding.evidence.length > 0 && (
                        <div className="mt-2 space-y-1 text-muted-foreground">
                          {finding.evidence.slice(0, 2).map((item) => (
                            <div key={item} className="min-w-0">
                              <EvidenceLink value={item} />
                            </div>
                          ))}
                        </div>
                      )}
                      {onWaiveFinding && finding.severity !== "blocking" && finding.computedStatus === "open" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 px-2 text-xs shadow-none"
                          disabled={Boolean(pendingWaiveFindingId)}
                          onClick={() => handleWaive(finding)}
                        >
                          <Square className="mr-1.5 h-3 w-3" />
                          {pendingWaiveFindingId === finding.id ? "Waiving" : "Waive"}
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
