export interface PrSummary {
  number: number;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
}

export interface BranchRow {
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

export interface PrRow {
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
  state: string;
  isDraft: boolean;
  mergeable: string;
  url: string;
  updatedAt: string;
  statusCheckRollup: 'PASS' | 'PENDING' | 'FAIL' | 'NONE';
}

export interface CodexJob {
  id: string;
  kind: string;
  status: string;
  phase?: string;
  title?: string;
  summary?: string;
  elapsed?: string;
  duration?: string;
}

export interface CodexJobsResponse {
  available: boolean;
  running: CodexJob[];
  recent: CodexJob[];
  error?: string;
}

export interface Health {
  repo: string;
  codexCompanion: string | null;
  branch: string;
}

export interface PromptAction {
  id: 'codex-claudemd-review' | 'codex-fix-loop';
  title: string;
  command: string;
  description: string;
  prompt: string;
  runnable: boolean;
}

export interface PromptActionsResponse {
  canRun: boolean;
  reviewBase: string;
  actions: PromptAction[];
}

export interface PromptRunResponse {
  ok: boolean;
  stdout: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<Health>('/api/health'),
  branches: () => get<BranchRow[]>('/api/branches'),
  prs: () => get<PrRow[]>('/api/prs'),
  codexJobs: () => get<CodexJobsResponse>('/api/codex-jobs'),
  promptActions: () => get<PromptActionsResponse>('/api/prompt-actions'),
  runPromptAction: (actionId: PromptAction['id']) => post<PromptRunResponse>('/api/prompt-runs', { actionId }),
};
