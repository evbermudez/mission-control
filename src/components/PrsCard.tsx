import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { statusEmoji, timeSince } from '../lib/format';

function hasMergeConflict(mergeable: string): boolean {
  return mergeable.toUpperCase() === 'CONFLICTING';
}

export default function PrsCard() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['prs'],
    queryFn: api.prs,
    refetchInterval: 30_000,
  });

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">My open PRs</h2>
        <button
          onClick={() => refetch()}
          className="text-xs text-neutral-500 hover:text-neutral-200 transition"
          disabled={isFetching}
        >
          {isFetching ? 'refreshing…' : 'refresh'}
        </button>
      </header>

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading PRs…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-neutral-500">no open PRs (or `gh` not authenticated)</p>
      ) : (
        <ul className="space-y-2">
          {data.map((p) => {
            const isConflicting = hasMergeConflict(p.mergeable);

            return (
              <li
                key={p.number}
                className={`flex items-center justify-between text-xs gap-3 rounded-md px-2 py-1.5 -mx-2 ${
                  isConflicting ? 'bg-red-950/30 border border-red-900/50' : 'border border-transparent'
                }`}
              >
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex-1 min-w-0 transition ${
                    isConflicting ? 'hover:text-red-300' : 'hover:text-emerald-300'
                  }`}
                >
                  <span className="mr-2">{statusEmoji(p.statusCheckRollup)}</span>
                  <span className={`font-mono mr-2 ${isConflicting ? 'text-red-300' : 'text-neutral-400'}`}>#{p.number}</span>
                  <span className={isConflicting ? 'text-red-100' : 'text-neutral-200'}>{p.title}</span>
                  {p.isDraft && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                      draft
                    </span>
                  )}
                  {isConflicting && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-red-200 bg-red-900/60 border border-red-700/60 px-1.5 py-0.5 rounded">
                      conflict
                    </span>
                  )}
                </a>
                <span className={`font-mono shrink-0 ${isConflicting ? 'text-red-300' : 'text-neutral-500'}`}>{p.branch}</span>
                <span className={isConflicting ? 'text-red-400/80 shrink-0' : 'text-neutral-600 shrink-0'}>{timeSince(p.updatedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
