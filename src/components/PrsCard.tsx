import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { statusEmoji, timeSince } from '../lib/format';

type ConflictKind = 'merge' | 'rebase' | 'merge + rebase' | null;

function conflictKind(mergeable: string, mergeStateStatus: string, rebaseable: boolean | null): ConflictKind {
  const hasMergeConflict = mergeable.toUpperCase() === 'CONFLICTING' || mergeStateStatus.toUpperCase() === 'DIRTY';
  const hasRebaseConflict = rebaseable === false;

  if (hasMergeConflict && hasRebaseConflict) return 'merge + rebase';
  if (hasMergeConflict) return 'merge';
  if (hasRebaseConflict) return 'rebase';
  return null;
}

export default function PrsCard() {
  const [showDrafts, setShowDrafts] = useState(false);
  const { data, error, isError, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['prs'],
    queryFn: api.prs,
    refetchInterval: 30_000,
  });

  const draftCount = useMemo(() => (data ?? []).filter((p) => p.isDraft).length, [data]);
  const visiblePrs = useMemo(
    () => (showDrafts ? (data ?? []) : (data ?? []).filter((p) => !p.isDraft)),
    [data, showDrafts],
  );

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">My open PRs</h2>
        <div className="flex items-center gap-3">
          {draftCount > 0 && (
            <button
              onClick={() => setShowDrafts((v) => !v)}
              className="text-xs text-neutral-500 hover:text-neutral-200 transition"
            >
              {showDrafts ? `hide drafts (${draftCount})` : `show drafts (${draftCount})`}
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="text-xs text-neutral-500 hover:text-neutral-200 transition"
            disabled={isFetching}
          >
            {isFetching ? 'refreshing…' : 'refresh'}
          </button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading PRs…</p>
      ) : isError ? (
        <p className="text-xs text-red-300">{error instanceof Error ? error.message : 'could not load PRs'}</p>
      ) : visiblePrs.length === 0 ? (
        <p className="text-xs text-neutral-500">
          {draftCount > 0 ? `no open PRs (${draftCount} draft${draftCount === 1 ? '' : 's'} hidden)` : 'no open PRs'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visiblePrs.map((p) => {
            const conflict = conflictKind(p.mergeable, p.mergeStateStatus, p.rebaseable);
            const isConflicting = conflict !== null;

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
                    <span
                      className="ml-2 text-[10px] uppercase tracking-wider text-red-200 bg-red-900/60 border border-red-700/60 px-1.5 py-0.5 rounded"
                      title={`${conflict} conflict`}
                    >
                      {conflict} conflict
                    </span>
                  )}
                  {p.reviewDecision === 'CHANGES_REQUESTED' && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-200 bg-amber-900/50 border border-amber-700/60 px-1.5 py-0.5 rounded">
                      changes requested
                    </span>
                  )}
                </a>
                <span
                  className={`font-mono shrink-0 max-w-72 truncate ${
                    isConflicting ? 'text-red-300' : 'text-neutral-500'
                  }`}
                  title={`${p.branch} merges into ${p.baseBranch}`}
                >
                  {p.branch} -&gt; <span className={isConflicting ? 'text-red-200' : 'text-neutral-300'}>{p.baseBranch}</span>
                </span>
                <span className={isConflicting ? 'text-red-400/80 shrink-0' : 'text-neutral-600 shrink-0'}>{timeSince(p.updatedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
