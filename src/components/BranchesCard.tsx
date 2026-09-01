import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { aheadBehindClass, aheadBehindLabel, copy } from '../lib/format';

const PAGE_SIZE = 5;

function prStateClass(state: 'OPEN' | 'CLOSED' | 'MERGED'): string {
  if (state === 'OPEN') return 'text-emerald-400';
  if (state === 'MERGED') return 'text-violet-400';
  return 'text-neutral-500';
}

export default function BranchesCard({ currentBranch }: { currentBranch: string }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['branches'],
    queryFn: api.branches,
    refetchInterval: 30_000,
  });

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data ?? [];

    return (data ?? []).filter((branch) => branch.name.toLowerCase().includes(query));
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleBranches = useMemo(
    () => filteredBranches.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [filteredBranches, currentPage],
  );
  const showPagination = filteredBranches.length > PAGE_SIZE;
  const firstVisible = currentPage * PAGE_SIZE + 1;
  const lastVisible = Math.min(filteredBranches.length, (currentPage + 1) * PAGE_SIZE);
  const hasSearch = search.trim().length > 0;

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">Branches</h2>
        <button
          onClick={() => refetch()}
          className="text-xs text-neutral-500 hover:text-neutral-200 transition"
          disabled={isFetching}
        >
          {isFetching ? 'refreshing…' : 'refresh'}
        </button>
      </header>

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading branches…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-neutral-500">no branches found</p>
      ) : (
        <div className="space-y-3">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Filter branches"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-600"
          />

          {filteredBranches.length === 0 ? (
            <p className="text-xs text-neutral-500">no branches match {search.trim()}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-800">
                    <th className="py-2 pr-2 font-normal">Branch</th>
                    <th className="py-2 pr-2 font-normal">Last commit</th>
                    <th className="py-2 pr-2 font-normal text-right">vs staging</th>
                    <th className="py-2 pr-2 font-normal text-right">vs main</th>
                    <th className="py-2 pr-2 font-normal">Link</th>
                    <th className="py-2 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBranches.map((b) => (
                    <tr
                      key={b.name}
                      className={`border-b border-neutral-800/50 ${b.isCurrent ? 'bg-neutral-800/30' : ''}`}
                    >
                      <td className="py-2 pr-2 font-mono">
                        {b.isCurrent && <span className="text-emerald-400 mr-1">●</span>}
                        {b.name === currentBranch ? <strong>{b.name}</strong> : b.name}
                      </td>
                      <td className="py-2 pr-2 text-neutral-400">
                        <span className="font-mono text-neutral-500">{b.lastCommit.sha}</span>{' '}
                        <span className="truncate inline-block max-w-[28ch] align-bottom">{b.lastCommit.subject}</span>
                        <span className="text-neutral-600 ml-1">· {b.lastCommit.relativeDate}</span>
                      </td>
                      <td className={`py-2 pr-2 text-right font-mono ${aheadBehindClass(b.aheadStaging, b.behindStaging)}`}>
                        {aheadBehindLabel(b.aheadStaging, b.behindStaging)}
                      </td>
                      <td className={`py-2 pr-2 text-right font-mono ${aheadBehindClass(b.aheadMain, b.behindMain)}`}>
                        {aheadBehindLabel(b.aheadMain, b.behindMain)}
                      </td>
                      <td className="py-2 pr-2">
                        {b.pr ? (
                          <a
                            href={b.pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`hover:underline ${prStateClass(b.pr.state)}`}
                            title={`PR #${b.pr.number} (${b.pr.state.toLowerCase()})`}
                          >
                            #{b.pr.number}
                          </a>
                        ) : b.branchUrl ? (
                          <a
                            href={b.branchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-500 hover:text-neutral-200 transition"
                            title="Open branch on GitHub"
                          >
                            github
                          </a>
                        ) : (
                          <span className="text-neutral-700">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => copy(`git checkout ${b.name}`)}
                          className="text-neutral-500 hover:text-neutral-200 text-xs transition"
                          title="Copy git checkout command"
                        >
                          copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(showPagination || hasSearch) && (
                <footer className="flex items-center justify-between gap-3 pt-3 text-xs text-neutral-500">
                  <span>
                    {firstVisible}-{lastVisible} of {filteredBranches.length}
                    {hasSearch && <span className="text-neutral-600"> filtered</span>}
                  </span>
                  {showPagination && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="text-neutral-500 hover:text-neutral-200 transition disabled:text-neutral-700 disabled:hover:text-neutral-700"
                        disabled={currentPage === 0}
                      >
                        prev
                      </button>
                      <span className="font-mono text-neutral-600">
                        {currentPage + 1}/{totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        className="text-neutral-500 hover:text-neutral-200 transition disabled:text-neutral-700 disabled:hover:text-neutral-700"
                        disabled={currentPage === totalPages - 1}
                      >
                        next
                      </button>
                    </div>
                  )}
                </footer>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
