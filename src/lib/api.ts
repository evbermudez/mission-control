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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<Health>('/api/health'),
  branches: () => get<BranchRow[]>('/api/branches'),
  prs: () => get<PrRow[]>('/api/prs'),
  codexJobs: () => get<CodexJobsResponse>('/api/codex-jobs'),
};
