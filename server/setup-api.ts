import type { Connect } from 'vite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const exec = promisify(execFile);

type Env = Record<string, string>;

export function setupApi(middlewares: Connect.Server, env: Env) {
  const cwd = env.MC_REPO_PATH;
  const codexCompanion = env.MC_CODEX_COMPANION || resolveCodexCompanion();

  middlewares.use('/api/health', json(async () => ({
    repo: cwd,
    codexCompanion: codexCompanion || null,
    branch: await currentBranch(cwd),
  })));

  middlewares.use('/api/branches', json(() => listBranches(cwd)));

  middlewares.use('/api/prs', json(() => listMyPrs(cwd)));

  middlewares.use('/api/codex-jobs', json(() => listCodexJobs(codexCompanion, cwd)));
}

// ── Endpoints ──────────────────────────────────────────────────────────────

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
    const { stdout } = await exec(
      'gh',
      [
        'pr',
        'list',
        '--author',
        '@me',
        '--state',
        'all',
        '--limit',
        '100',
        '--json',
        'number,headRefName,url,state',
      ],
      { cwd },
    );
    const prs = JSON.parse(stdout) as Array<{ number: number; headRefName: string; url: string; state: PrSummary['state'] }>;
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
  state: string;
  isDraft: boolean;
  mergeable: string;
  url: string;
  updatedAt: string;
  statusCheckRollup: 'PASS' | 'PENDING' | 'FAIL' | 'NONE';
}

async function listMyPrs(cwd: string): Promise<PrRow[]> {
  try {
    const { stdout } = await exec(
      'gh',
      [
        'pr',
        'list',
        '--author',
        '@me',
        '--state',
        'open',
        '--json',
        'number,title,headRefName,state,isDraft,mergeable,url,updatedAt,statusCheckRollup',
        '--limit',
        '30',
      ],
      { cwd },
    );
    const raw = JSON.parse(stdout) as Array<{
      number: number;
      title: string;
      headRefName: string;
      state: string;
      isDraft: boolean;
      mergeable: string;
      url: string;
      updatedAt: string;
      statusCheckRollup: Array<{ conclusion?: string; state?: string }>;
    }>;
    return raw.map((p) => ({
      number: p.number,
      title: p.title,
      branch: p.headRefName,
      state: p.state,
      isDraft: p.isDraft,
      mergeable: p.mergeable,
      url: p.url,
      updatedAt: p.updatedAt,
      statusCheckRollup: rollupStatus(p.statusCheckRollup),
    }));
  } catch (err) {
    console.error('[mission-control] gh pr list failed:', (err as Error).message);
    return [];
  }
}

function rollupStatus(checks: Array<{ conclusion?: string; state?: string }>): 'PASS' | 'PENDING' | 'FAIL' | 'NONE' {
  if (!checks || checks.length === 0) return 'NONE';
  const states = checks.map((c) => (c.conclusion || c.state || '').toUpperCase());
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

function resolveCodexCompanion(): string | null {
  const base = join(homedir(), '.claude', 'plugins', 'cache', 'openai-codex', 'codex');
  if (!existsSync(base)) return null;
  const versions = readdirSync(base).filter((v) => existsSync(join(base, v, 'scripts', 'codex-companion.mjs')));
  if (versions.length === 0) return null;
  versions.sort().reverse();
  return join(base, versions[0], 'scripts', 'codex-companion.mjs');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function json<T>(handler: () => Promise<T>): Connect.NextHandleFunction {
  return async (_req, res) => {
    try {
      const payload = await handler();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  };
}
