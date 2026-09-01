import { useQuery } from '@tanstack/react-query';
import { api, type ContributionWeek, type Contributor } from '../lib/api';
import WeeklyBarChart, { type ChartSeries } from './WeeklyBarChart';

const CONTRIBUTOR_COLORS: Record<string, string> = {
  eric: '#34d399',
  hrishabh: '#60a5fa',
  giorgio: '#fbbf24',
  giuseppe: '#f472b6',
  gncao523: '#22d3ee',
  leaptime: '#a78bfa',
  claude: '#fb923c',
  apple: '#a3e635',
};

export default function CommitActivityCard() {
  const commits = useQuery({
    queryKey: ['commit-activity'],
    queryFn: api.commitActivity,
    refetchInterval: 5 * 60_000,
  });
  const mergedPrs = useQuery({
    queryKey: ['merged-pr-activity'],
    queryFn: api.mergedPrActivity,
    refetchInterval: 5 * 60_000,
  });
  const isFetching = commits.isFetching || mergedPrs.isFetching;
  const contributors = mergeContributors(commits.data?.contributors ?? [], mergedPrs.data?.contributors ?? []);
  const contributorSeries = chartSeries(contributors);

  const refresh = () => {
    void commits.refetch();
    void mergedPrs.refetch();
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-300">Delivery activity</h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">Weekly activity since May · Manila time</p>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-neutral-500 hover:text-neutral-200 transition"
          disabled={isFetching}
        >
          {isFetching ? 'refreshing…' : 'refresh'}
        </button>
      </header>

      {commits.isLoading ? (
        <p className="text-xs text-neutral-500">loading commit activity…</p>
      ) : commits.isError ? (
        <ActivityError error={commits.error} fallback="could not load commit activity" />
      ) : commits.data ? (
        <div className="space-y-5">
          <ActivityGraph
            title="Unique commits"
            description="Unique non-merge commits across the full origin/staging graph"
          >
            <WeeklyBarChart
              ariaLabel="Stacked bar chart of unique weekly commits since May"
              series={contributorSeries}
              weeks={commits.data.weeks}
            />
          </ActivityGraph>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 border-t border-neutral-800 pt-4">
            <ActivityGraph
              title="First-parent commits"
              description="Direct and squash landing commits on origin/staging"
            >
              <WeeklyBarChart
                ariaLabel="Bar chart of weekly first-parent commits since May"
                compact
                series={contributorSeries}
                weeks={commits.data.firstParentWeeks}
              />
            </ActivityGraph>

            <ActivityGraph title="Merged PRs" description="Pull requests merged into staging by merged time">
              {mergedPrs.isLoading ? (
                <p className="text-xs text-neutral-500 py-8">loading merged PRs…</p>
              ) : mergedPrs.isError ? (
                <ActivityError error={mergedPrs.error} fallback="could not load merged PR activity" />
              ) : mergedPrs.data ? (
                <WeeklyBarChart
                  ariaLabel="Bar chart of pull requests merged into staging each week since May"
                  compact
                  series={contributorSeries}
                  weeks={mergedPrs.data.weeks}
                />
              ) : null}
            </ActivityGraph>
          </div>
          <ChartLegend series={contributorSeries} />
        </div>
      ) : (
        <p className="text-xs text-neutral-500">no activity since May</p>
      )}
    </section>
  );
}

function ActivityGraph({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-neutral-300">{title}</h3>
      <p className="text-[10px] text-neutral-600 mt-0.5 mb-2">{description}</p>
      {children}
    </div>
  );
}

function ChartLegend({ series }: { series: ChartSeries<ContributionWeek>[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-neutral-400">
      {series.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ActivityError({ error, fallback }: { error: Error | null; fallback: string }) {
  return <p className="text-xs text-red-300 py-4">{error?.message ?? fallback}</p>;
}

function mergeContributors(...groups: Contributor[][]): Contributor[] {
  const contributors = new Map<string, Contributor>();
  for (const group of groups) {
    for (const contributor of group) contributors.set(contributor.key, contributor);
  }
  return [...contributors.values()];
}

function chartSeries(contributors: Contributor[]): ChartSeries<ContributionWeek>[] {
  return contributors.map((contributor, index) => ({
    label: contributor.label,
    color: CONTRIBUTOR_COLORS[contributor.key] ?? fallbackColor(index),
    value: (week) => week.contributions[contributor.key] ?? 0,
  }));
}

function fallbackColor(index: number): string {
  const colors = ['#e879f9', '#2dd4bf', '#f87171', '#818cf8', '#facc15'];
  return colors[index % colors.length];
}
