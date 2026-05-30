import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { copy } from '../lib/format';

export default function CodexJobsCard() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['codex-jobs'],
    queryFn: api.codexJobs,
    refetchInterval: 10_000,
  });

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">Codex jobs</h2>
        <button
          onClick={() => refetch()}
          className="text-xs text-neutral-500 hover:text-neutral-200 transition"
          disabled={isFetching}
        >
          {isFetching ? 'refreshing…' : 'refresh'}
        </button>
      </header>

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading…</p>
      ) : !data?.available ? (
        <p className="text-xs text-neutral-500">codex companion not found</p>
      ) : (
        <div className="space-y-4">
          <Section title="Running" jobs={data.running} emptyText="no jobs running" />
          <Section title="Recent" jobs={data.recent} emptyText="no recent jobs" />
        </div>
      )}
    </section>
  );
}

function Section({ title, jobs, emptyText }: { title: string; jobs: Array<{ id: string; kind: string; status: string; phase?: string; title?: string; summary?: string; elapsed?: string; duration?: string }>; emptyText: string }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">{title}</h3>
      {jobs.length === 0 ? (
        <p className="text-xs text-neutral-600">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {jobs.map((j) => (
            <li key={j.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 ${statusColor(j.status)}`}>{statusDot(j.status)}</span>
                <span className="text-neutral-200 truncate flex-1 min-w-0">{j.title ?? j.kind}</span>
                <span className="text-neutral-500 shrink-0">{j.elapsed ?? j.duration ?? ''}</span>
              </div>
              {j.summary && <p className="text-neutral-500 mt-0.5 ml-3.5 line-clamp-2">{j.summary}</p>}
              <div className="ml-3.5 mt-1 flex gap-2">
                <button onClick={() => copy(`/codex:status ${j.id}`)} className="text-neutral-600 hover:text-neutral-300 text-[10px] transition">
                  copy /codex:status
                </button>
                <button onClick={() => copy(`/codex:result ${j.id}`)} className="text-neutral-600 hover:text-neutral-300 text-[10px] transition">
                  copy /codex:result
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'running': return 'text-amber-400';
    case 'completed': return 'text-emerald-400';
    case 'cancelled': return 'text-neutral-500';
    case 'failed': return 'text-red-400';
    default: return 'text-neutral-400';
  }
}

function statusDot(status: string): string {
  switch (status) {
    case 'running': return '◐';
    case 'completed': return '●';
    case 'cancelled': return '○';
    case 'failed': return '✕';
    default: return '·';
  }
}
