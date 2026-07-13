import { and, eq } from 'drizzle-orm';
import { getAppDb } from './db';
import type { AppDb } from './db';
import {
  githubProjects,
  githubSignalSubscriptions,
  type GithubSignalSubscriptionRow,
  type NewGithubSignalSubscriptionRow,
} from './schema';

export type GithubSignalSubscriptionSource = NewGithubSignalSubscriptionRow['source'];

export interface SubscribeToPullRequestInput {
  orgId: string;
  installationId: number;
  githubProjectId: string;
  repoId: number;
  pullRequestNumber: number;
  sessionId: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
  source: GithubSignalSubscriptionSource;
  subscribedByUserId?: string;
}

export interface ThreadSubscriptionTarget {
  orgId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
}

export interface PullRequestSubscriptionTarget {
  orgId: string;
  installationId: number;
  repoId: number;
  pullRequestNumber: number;
}

export type GithubWebhookPullRequestTarget = Omit<PullRequestSubscriptionTarget, 'orgId'>;

function normalizedScope(scope: string | undefined): string {
  return scope ?? '';
}

async function loadOwnedProject(db: AppDb, input: SubscribeToPullRequestInput) {
  const [project] = await db
    .select()
    .from(githubProjects)
    .where(and(eq(githubProjects.id, input.githubProjectId), eq(githubProjects.orgId, input.orgId)));

  if (!project || project.installationId !== input.installationId || project.repoId !== input.repoId) {
    throw new Error('GitHub project not found for this organization and repository.');
  }

  return project;
}

function targetConditions(input: SubscribeToPullRequestInput) {
  return and(
    eq(githubSignalSubscriptions.orgId, input.orgId),
    eq(githubSignalSubscriptions.githubProjectId, input.githubProjectId),
    eq(githubSignalSubscriptions.repoId, input.repoId),
    eq(githubSignalSubscriptions.pullRequestNumber, input.pullRequestNumber),
    eq(githubSignalSubscriptions.sessionId, input.sessionId),
    eq(githubSignalSubscriptions.resourceId, input.resourceId),
    eq(githubSignalSubscriptions.threadId, input.threadId),
    eq(githubSignalSubscriptions.sessionScope, normalizedScope(input.sessionScope)),
  );
}

export async function subscribeToPullRequest(
  input: SubscribeToPullRequestInput,
  db: AppDb = getAppDb(),
): Promise<GithubSignalSubscriptionRow> {
  const project = await loadOwnedProject(db, input);
  const values: NewGithubSignalSubscriptionRow = {
    orgId: input.orgId,
    installationId: input.installationId,
    githubProjectId: input.githubProjectId,
    repoId: input.repoId,
    repoFullName: project.repoFullName,
    pullRequestNumber: input.pullRequestNumber,
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    resourceId: input.resourceId,
    threadId: input.threadId,
    sessionScope: normalizedScope(input.sessionScope),
    source: input.source,
    subscribedByUserId: input.subscribedByUserId,
  };

  const [created] = await db
    .insert(githubSignalSubscriptions)
    .values(values)
    .onConflictDoNothing({
      target: [
        githubSignalSubscriptions.orgId,
        githubSignalSubscriptions.githubProjectId,
        githubSignalSubscriptions.repoId,
        githubSignalSubscriptions.pullRequestNumber,
        githubSignalSubscriptions.sessionId,
        githubSignalSubscriptions.resourceId,
        githubSignalSubscriptions.threadId,
        githubSignalSubscriptions.sessionScope,
      ],
    })
    .returning();

  if (created) return created;

  const [existing] = await db.select().from(githubSignalSubscriptions).where(targetConditions(input));
  if (!existing) throw new Error('GitHub signal subscription conflict could not be resolved.');
  return existing;
}

export async function unsubscribeFromPullRequest(
  input: SubscribeToPullRequestInput,
  db: AppDb = getAppDb(),
): Promise<void> {
  await loadOwnedProject(db, input);
  await db.delete(githubSignalSubscriptions).where(targetConditions(input));
}

export async function listPullRequestSubscriptionsForThread(
  input: ThreadSubscriptionTarget,
  db: AppDb = getAppDb(),
): Promise<GithubSignalSubscriptionRow[]> {
  return db
    .select()
    .from(githubSignalSubscriptions)
    .where(
      and(
        eq(githubSignalSubscriptions.orgId, input.orgId),
        eq(githubSignalSubscriptions.resourceId, input.resourceId),
        eq(githubSignalSubscriptions.threadId, input.threadId),
        eq(githubSignalSubscriptions.sessionScope, normalizedScope(input.sessionScope)),
      ),
    );
}

export async function listPullRequestSubscriptions(
  input: PullRequestSubscriptionTarget,
  db: AppDb = getAppDb(),
): Promise<GithubSignalSubscriptionRow[]> {
  return db
    .select()
    .from(githubSignalSubscriptions)
    .where(
      and(
        eq(githubSignalSubscriptions.orgId, input.orgId),
        eq(githubSignalSubscriptions.installationId, input.installationId),
        eq(githubSignalSubscriptions.repoId, input.repoId),
        eq(githubSignalSubscriptions.pullRequestNumber, input.pullRequestNumber),
      ),
    );
}

export async function listPullRequestSubscriptionsForWebhook(
  input: GithubWebhookPullRequestTarget,
  db: AppDb = getAppDb(),
): Promise<GithubSignalSubscriptionRow[]> {
  return db
    .select()
    .from(githubSignalSubscriptions)
    .where(
      and(
        eq(githubSignalSubscriptions.installationId, input.installationId),
        eq(githubSignalSubscriptions.repoId, input.repoId),
        eq(githubSignalSubscriptions.pullRequestNumber, input.pullRequestNumber),
      ),
    );
}

export async function retirePullRequestSubscription(id: string, db: AppDb = getAppDb()): Promise<void> {
  await db.delete(githubSignalSubscriptions).where(eq(githubSignalSubscriptions.id, id));
}

export async function retirePullRequestSubscriptions(
  input: PullRequestSubscriptionTarget,
  db: AppDb = getAppDb(),
): Promise<void> {
  await db
    .delete(githubSignalSubscriptions)
    .where(
      and(
        eq(githubSignalSubscriptions.orgId, input.orgId),
        eq(githubSignalSubscriptions.installationId, input.installationId),
        eq(githubSignalSubscriptions.repoId, input.repoId),
        eq(githubSignalSubscriptions.pullRequestNumber, input.pullRequestNumber),
      ),
    );
}
