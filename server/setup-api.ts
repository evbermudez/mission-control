import type { Connect } from 'vite';
import { execFile } from 'node:child_process';
import type { IncomingMessage } from 'node:http';
import { promisify } from 'node:util';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const exec = promisify(execFile);

type Env = Record<string, string>;

export function setupApi(middlewares: Connect.Server, env: Env) {
  const cwd = env.MC_REPO_PATH;
  const codexCompanion = env.MC_CODEX_COMPANION || resolveCodexCompanion();
  const promptRunsEnabled = env.MC_ENABLE_PROMPT_RUNS === '1';
  const reviewBase = env.MC_REVIEW_BASE || 'origin/staging';

  middlewares.use('/api/health', json(async () => ({
    repo: cwd,
    codexCompanion: codexCompanion || null,
    branch: await currentBranch(cwd),
  })));

  middlewares.use('/api/branches', json(() => listBranches(cwd)));

  middlewares.use('/api/prs', json(() => listMyPrs(cwd)));

  middlewares.use('/api/skills', json(() => listCustomSkills(cwd)));

  middlewares.use('/api/codex-jobs', json(() => listCodexJobs(codexCompanion, cwd)));

  middlewares.use('/api/prompt-actions', json(() => listPromptActions(promptRunsEnabled, reviewBase)));

  middlewares.use('/api/prompt-runs', json(async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'POST required');
    const body = await readJsonBody<PromptRunRequest>(req);
    return runPromptAction(codexCompanion, cwd, promptRunsEnabled, reviewBase, body.actionId);
  }));
}

// ── Endpoints ──────────────────────────────────────────────────────────────

interface SkillRow {
  name: string;
  description: string;
  source: 'personal' | 'project';
}

function listCustomSkills(cwd: string): SkillRow[] {
  const locations: Array<{ root: string; source: SkillRow['source'] }> = [
    { root: join(homedir(), '.codex', 'skills'), source: 'personal' },
    { root: join(cwd, '.agents', 'skills'), source: 'project' },
  ];
  const skills = new Map<string, SkillRow>();

  for (const { root, source } of locations) {
    if (!existsSync(root)) continue;

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const skillFile = join(root, entry.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const metadata = readSkillMetadata(skillFile);
      const name = metadata.name || entry.name;
      skills.set(name, { name, description: metadata.description, source });
    }
  }

  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function readSkillMetadata(skillFile: string): { name: string; description: string } {
  const content = readFileSync(skillFile, 'utf8');
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
  const lines = frontmatter.split('\n');
  const name = unquote(lines.find((line) => line.startsWith('name:'))?.slice(5).trim() ?? '');
  const descriptionIndex = lines.findIndex((line) => line.startsWith('description:'));

  if (descriptionIndex === -1) return { name, description: '' };

  const initial = lines[descriptionIndex].slice('description:'.length).trim();
  if (initial !== '>' && initial !== '|') {
    return { name, description: unquote(initial) };
  }

  const descriptionLines: string[] = [];
  for (const line of lines.slice(descriptionIndex + 1)) {
    if (!/^\s+/.test(line)) break;
    descriptionLines.push(line.trim());
  }
  const description = descriptionLines.join(' ');
  return { name, description };
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

async function currentBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await exec('git', ['branch', '--show-current'], { cwd });
    return stdout.trim();
  } catch {
    return '';
  }
}

interface PrSummary {
  number: number;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
}

interface BranchRow {
  name: string;
  isCurrent: boolean;
  lastCommit: { sha: string; subject: string; relativeDate: string };
  aheadStaging: number;
  behindStaging: number;
  aheadMain: number;
  behindMain: number;
  pr: PrSummary | null;
  branchUrl: string | null;
}

async function listBranches(cwd: string): Promise<BranchRow[]> {
  const current = await currentBranch(cwd);
  const [{ stdout }, prsByBranch, repo] = await Promise.all([
    exec(
      'git',
      [
        'for-each-ref',
        '--sort=-committerdate',
        '--format=%(refname:short)%09%(objectname:short)%09%(contents:subject)%09%(committerdate:relative)',
        'refs/heads/',
      ],
      { cwd },
    ),
    prsByBranchMap(cwd),
    parseGitHubRepo(cwd),
  ]);

  const rows = stdout.trim().split('\n').filter(Boolean).map((line) => {
    const [name, sha, subject, relativeDate] = line.split('\t');
    return { name, sha, subject, relativeDate };
  });

  const results = await Promise.all(
    rows.map(async (r) => {
      const [staging, main] = await Promise.all([
        aheadBehind(cwd, 'origin/staging', r.name),
        aheadBehind(cwd, 'origin/main', r.name),
      ]);
      return {
        name: r.name,
        isCurrent: r.name === current,
        lastCommit: { sha: r.sha, subject: r.subject, relativeDate: r.relativeDate },
        aheadStaging: staging.ahead,
        behindStaging: staging.behind,
        aheadMain: main.ahead,
        behindMain: main.behind,
        pr: prsByBranch.get(r.name) ?? null,
        branchUrl: repo ? `https://github.com/${repo}/tree/${encodeURIComponent(r.name)}` : null,
      } satisfies BranchRow;
    }),
  );

  return results;
}

async function prsByBranchMap(cwd: string): Promise<Map<string, PrSummary>> {
  try {
    const repo = await requiredGitHubRepo(cwd);
    const prs = await searchPullRequests<{
      number: number;
      headRefName: string;
      url: string;
      state: PrSummary['state'];
    }>(cwd, repo, 'is:pr author:@me', 100);

    const map = new Map<string, PrSummary>();
    for (const p of prs) {
      const existing = map.get(p.headRefName);
      // Prefer OPEN > MERGED > CLOSED so an active PR wins over an old closed one.
      if (!existing || prRank(p.state) > prRank(existing.state)) {
        map.set(p.headRefName, { number: p.number, url: p.url, state: p.state });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function prRank(state: PrSummary['state']): number {
  return state === 'OPEN' ? 3 : state === 'MERGED' ? 2 : 1;
}

async function parseGitHubRepo(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['remote', 'get-url', 'origin'], { cwd });
    const url = stdout.trim();
    // Matches https://github.com/owner/repo(.git) and git@github.com:owner/repo(.git)
    const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

async function aheadBehind(cwd: string, base: string, branch: string): Promise<{ ahead: number; behind: number }> {
  try {
    const { stdout } = await exec('git', ['rev-list', '--left-right', '--count', `${base}...${branch}`], { cwd });
    const [behind, ahead] = stdout.trim().split('\t').map(Number);
    return { ahead, behind };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

interface PrRow {
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
  state: string;
  isDraft: boolean;
  mergeable: string;
  mergeStateStatus: string;
  rebaseable: boolean | null;
  reviewDecision: ReviewDecision;
  url: string;
  updatedAt: string;
  statusCheckRollup: 'PASS' | 'PENDING' | 'FAIL' | 'NONE';
}

type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

async function listMyPrs(cwd: string): Promise<PrRow[]> {
  const repo = await requiredGitHubRepo(cwd);
  const raw = await searchPullRequests<{
    number: number;
    title: string;
    headRefName: string;
    baseRefName: string;
    state: string;
    isDraft: boolean;
    mergeable: string;
    mergeStateStatus: string;
    reviewDecision: ReviewDecision;
    url: string;
    updatedAt: string;
    statusCheckRollup: {
      contexts?: {
        nodes?: Array<{ conclusion?: string | null; status?: string | null; state?: string | null } | null>;
      } | null;
    } | null;
  }>(cwd, repo, 'is:pr is:open author:@me', 30);

  const rebaseability = await Promise.all(raw.map((p) => getPrRebaseability(cwd, repo, p.number)));

  return raw.map((p, index) => ({
    number: p.number,
    title: p.title,
    branch: p.headRefName,
    baseBranch: p.baseRefName,
    state: p.state,
    isDraft: p.isDraft,
    mergeable: p.mergeable,
    mergeStateStatus: p.mergeStateStatus,
    rebaseable: rebaseability[index],
    reviewDecision: p.reviewDecision ?? null,
    url: p.url,
    updatedAt: p.updatedAt,
    statusCheckRollup: rollupStatus(p.statusCheckRollup?.contexts?.nodes ?? []),
  }));
}

async function getPrRebaseability(cwd: string, repo: string, number: number): Promise<boolean | null> {
  try {
    const { stdout } = await exec('gh', ['api', `repos/${repo}/pulls/${number}`, '--jq', '.rebaseable'], { cwd });
    const value = stdout.trim();
    return value === 'true' ? true : value === 'false' ? false : null;
  } catch {
    return null;
  }
}

const PR_SEARCH_GRAPHQL = `query($q: String!, $limit: Int!) {
  search(type: ISSUE, query: $q, first: $limit) {
    nodes {
      ... on PullRequest {
        number
        title
        headRefName
        baseRefName
        state
        isDraft
        mergeable
        mergeStateStatus
        reviewDecision
        url
        updatedAt
        statusCheckRollup {
          contexts(first: 50) {
            nodes {
              ... on CheckRun {
                conclusion
                status
              }
              ... on StatusContext {
                state
              }
            }
          }
        }
      }
    }
  }
}`;

async function requiredGitHubRepo(cwd: string): Promise<string> {
  const repo = await parseGitHubRepo(cwd);
  if (!repo) {
    throw new HttpError(500, 'Could not resolve GitHub repo from origin remote');
  }
  return repo;
}

async function searchPullRequests<T>(cwd: string, repo: string, qualifiers: string, limit: number): Promise<T[]> {
  const { stdout } = await exec(
    'gh',
    ['api', 'graphql', '-f', `query=${PR_SEARCH_GRAPHQL}`, '-F', `q=repo:${repo} ${qualifiers}`, '-F', `limit=${limit}`],
    { cwd },
  );

  const payload = JSON.parse(stdout) as {
    data?: {
      search?: {
        nodes?: Array<T | null>;
      };
    };
  };

  return (payload.data?.search?.nodes ?? []).filter((node): node is T => Boolean(node));
}

function rollupStatus(checks: Array<{ conclusion?: string | null; status?: string | null; state?: string | null } | null>): 'PASS' | 'PENDING' | 'FAIL' | 'NONE' {
  if (!checks || checks.length === 0) return 'NONE';
  const states = checks.map((c) => (c?.conclusion || c?.state || c?.status || '').toUpperCase());
  if (states.some((s) => s === 'FAILURE' || s === 'TIMED_OUT' || s === 'CANCELLED' || s === 'ACTION_REQUIRED')) return 'FAIL';
  if (states.some((s) => s === 'PENDING' || s === 'IN_PROGRESS' || s === 'QUEUED' || s === '')) return 'PENDING';
  if (states.every((s) => s === 'SUCCESS' || s === 'NEUTRAL' || s === 'SKIPPED')) return 'PASS';
  return 'PENDING';
}

interface CodexJob {
  id: string;
  kind: string;
  status: string;
  phase?: string;
  title?: string;
  summary?: string;
  elapsed?: string;
  duration?: string;
  startedAt?: string;
  completedAt?: string;
  threadId?: string;
}

interface CodexJobsResponse {
  available: boolean;
  running: CodexJob[];
  recent: CodexJob[];
  error?: string;
}

async function listCodexJobs(companion: string | null, cwd: string): Promise<CodexJobsResponse> {
  if (!companion || !existsSync(companion)) {
    return { available: false, running: [], recent: [], error: 'Codex companion not found' };
  }
  try {
    // The companion keys jobs by workspaceRoot; run it with cwd = MC_REPO_PATH
    // so we see jobs for the project we care about (Archimedes), not jobs that
    // would key off mission-control's own directory.
    const { stdout } = await exec('node', [companion, 'status', '--all', '--json'], { cwd });
    const data = JSON.parse(stdout) as {
      running?: CodexJob[];
      latestFinished?: CodexJob;
      recent?: CodexJob[];
    };
    // The companion exposes the latest finished job in `latestFinished` and
    // OLDER jobs in `recent` — they're disjoint. Merge them so the UI sees
    // a single ordered list with the most recent job first.
    const combined: CodexJob[] = [];
    const seen = new Set<string>();
    const push = (j: CodexJob | undefined) => {
      if (!j || seen.has(j.id)) return;
      seen.add(j.id);
      combined.push(j);
    };
    push(data.latestFinished);
    for (const j of data.recent ?? []) push(j);
    return {
      available: true,
      running: data.running ?? [],
      recent: combined.slice(0, 5),
    };
  } catch (err) {
    return { available: true, running: [], recent: [], error: (err as Error).message };
  }
}

interface PromptAction {
  id: 'codex-claudemd-review' | 'codex-fix-loop';
  title: string;
  command: string;
  description: string;
  prompt: string;
  runnable: boolean;
}

interface PromptActionsResponse {
  canRun: boolean;
  reviewBase: string;
  actions: PromptAction[];
}

interface PromptRunRequest {
  actionId: PromptAction['id'];
}

interface PromptRunResponse {
  ok: boolean;
  stdout: string;
}

function listPromptActions(canRun: boolean, reviewBase: string): PromptActionsResponse {
  return {
    canRun,
    reviewBase,
    actions: [
      {
        id: 'codex-claudemd-review',
        title: 'Codex AGENTS.md review',
        command: `/codex:claudemd-review --background --base ${reviewBase}`,
        description: `Start an independent background review of the current branch against ${reviewBase}.`,
        prompt: `/codex:claudemd-review --background --base ${reviewBase}`,
        runnable: canRun,
      },
      {
        id: 'codex-fix-loop',
        title: 'Fix and repeat review loop',
        command: 'codex task --background --write',
        description: 'Ask Codex to fix hard violations, handle small nits, verify, commit, push, then report the next review prompt.',
        prompt: buildFixLoopPrompt(reviewBase),
        runnable: canRun,
      },
    ],
  };
}

async function runPromptAction(
  companion: string | null,
  cwd: string,
  canRun: boolean,
  reviewBase: string,
  actionId: PromptAction['id'],
): Promise<PromptRunResponse> {
  if (!canRun) {
    throw new HttpError(403, 'Prompt runs are disabled. Set MC_ENABLE_PROMPT_RUNS=1 to enable.');
  }
  if (!companion || !existsSync(companion)) {
    throw new HttpError(503, 'Codex companion not found');
  }

  if (actionId === 'codex-claudemd-review') {
    const { stdout } = await exec(
      'node',
      [companion, 'adversarial-review', '--background', '--base', reviewBase, '--scope', 'branch', AGENTS_REVIEW_FOCUS],
      { cwd },
    );
    return { ok: true, stdout: stdout.trim() };
  }

  if (actionId === 'codex-fix-loop') {
    const { stdout } = await exec(
      'node',
      [companion, 'task', '--background', '--write', '--effort', 'high', buildFixLoopPrompt(reviewBase)],
      { cwd },
    );
    return { ok: true, stdout: stdout.trim() };
  }

  throw new HttpError(400, `Unknown action: ${actionId}`);
}

const AGENTS_REVIEW_FOCUS = `Review this branch through the lens of AGENTS.md at the repo root. That file is the authority. Every finding must map to a specific rule in it. Do not invent rules; if something feels wrong but is not in AGENTS.md, flag it as a nit, not a violation.

Return a Markdown review with:
- Compliance matrix
- Hard violations, with AGENTS.md citation and file:line
- Soft violations, with AGENTS.md citation and file:line when concrete
- Nits
- Strengths
- Verdict

Pay special attention to tenant architecture, module boundaries, Octane safety, frontend auth-gated queries, route naming, response shapes, tests, and generated-artifact churn.`;

function buildFixLoopPrompt(reviewBase: string): string {
  return `Use the Archimedes Codex Builder / Claude Reviewer Loop on the current branch.

Scope:
- Work only on the current branch and current ticket/PR.
- Compare against ${reviewBase} unless git state shows a more specific immediate base.
- Do not rebase, force-push, split commits, or remove commits without asking.
- Do not touch unrelated files or generated churn unless it is required by the fix.

Loop:
1. Inspect git status, current branch, open PR metadata if available, and recent Codex/Claude review findings if present.
2. Run an AGENTS.md review against ${reviewBase} using the claudemd-review framework.
3. Fix every hard violation that is in scope.
4. Fix soft violations and nits only when the change is small, low-risk, and in scope.
5. Convert remaining intentional soft violations into PR-description notes.
6. Run the smallest relevant tests/build.
7. Stage only intended files.
8. Generate a terse Conventional Commit message using the caveman-commit style, then commit and push the branch.
9. Start or provide the exact next /codex:claudemd-review --background --base ${reviewBase} command for a repeat review.
10. When the repeat review has no hard violations and no remaining nits, run/use the Archimedes pr-summary-format skill to produce or update the PR body.

Report:
- Fixed
- Left as PR note
- Verification
- Commit/push status
- Next review command, or PR summary status when the review loop is clean`;
}

function resolveCodexCompanion(): string | null {
  const base = join(homedir(), '.claude', 'plugins', 'cache', 'openai-codex', 'codex');
  if (!existsSync(base)) return null;
  const versions = readdirSync(base).filter((v) => existsSync(join(base, v, 'scripts', 'codex-companion.mjs')));
  if (versions.length === 0) return null;
  versions.sort().reverse();
  return join(base, versions[0], 'scripts', 'codex-companion.mjs');
}

// ── Helpers ────────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function json<T>(handler: (req: IncomingMessage) => T | Promise<T>): Connect.NextHandleFunction {
  return async (req, res) => {
    try {
      const payload = await handler(req);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    } catch (err) {
      res.statusCode = err instanceof HttpError ? err.statusCode : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  };
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {} as T;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}
