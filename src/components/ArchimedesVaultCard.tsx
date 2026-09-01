import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { timeSince } from '../lib/format';

export default function ArchimedesVaultCard() {
  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: ['archimedes-vault'],
    queryFn: api.archimedesVault,
    refetchInterval: 5 * 60_000,
  });

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-300">Archimedes Vault</h2>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            {data?.lastUpdatedAt ? `updated ${timeSince(data.lastUpdatedAt)}` : 'read-only knowledge view'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-neutral-500 hover:text-neutral-200 transition"
        >
          {isFetching ? 'refreshing…' : 'refresh'}
        </button>
      </header>

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading vault…</p>
      ) : isError ? (
        <p className="text-xs text-red-300">{error instanceof Error ? error.message : 'could not load vault'}</p>
      ) : !data?.available ? (
        <p className="text-xs text-amber-300">{data?.error || 'Archimedes vault is unavailable'}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <SectionTitle>Recent ticket scopes</SectionTitle>
            {data.scopes.length === 0 ? (
              <p className="text-xs text-neutral-500">no ticket scopes found</p>
            ) : (
              <ul className="space-y-1">
                {data.scopes.map((scope) => (
                  <li key={scope.url}>
                    <a
                      href={scope.url}
                      className="block rounded-md px-2 py-2 -mx-2 transition hover:bg-neutral-800"
                      title={`Open ${scope.title} in Obsidian`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-neutral-200">{scope.title}</span>
                        <span className="shrink-0 text-[10px] text-neutral-600">{timeSince(scope.updatedAt)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {scope.module && <Badge>{scope.module}</Badge>}
                        <Badge>{scope.tickets}</Badge>
                        {scope.stage && <Badge tone="active">{scope.stage}</Badge>}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <SectionTitle>Recently delivered</SectionTitle>
            {data.deliveries.length === 0 ? (
              <p className="text-xs text-neutral-500">no deliverable entries found</p>
            ) : (
              <ul className="space-y-1">
                {data.deliveries.map((delivery) => (
                  <li key={delivery.title}>
                    <a
                      href={delivery.url}
                      className="block rounded-md px-2 py-1.5 -mx-2 text-xs leading-5 text-neutral-300 transition hover:bg-neutral-800 hover:text-emerald-300"
                      title="Open deliverables log in Obsidian"
                    >
                      {delivery.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <SectionTitle>Knowledge shortcuts</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              {data.shortcuts.map((shortcut) => (
                <a
                  key={shortcut.label}
                  href={shortcut.url}
                  className="rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-2 transition hover:border-neutral-700 hover:bg-neutral-800"
                  title={shortcut.description}
                >
                  <span className="block text-xs text-neutral-300">{shortcut.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-neutral-600">{shortcut.description}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">{children}</h3>;
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'active' }) {
  return (
    <span className={`rounded px-1.5 py-0.5 ${
      tone === 'active'
        ? 'bg-emerald-950/60 text-emerald-400'
        : 'bg-neutral-800 text-neutral-500'
    }`}>
      {children}
    </span>
  );
}
