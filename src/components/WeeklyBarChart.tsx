import type { ActivityWeek } from '../lib/api';

export interface ChartSeries<T extends ActivityWeek> {
  label: string;
  color: string;
  value: (week: T) => number;
}

interface Props<T extends ActivityWeek> {
  ariaLabel: string;
  compact?: boolean;
  series: ChartSeries<T>[];
  weeks: T[];
}

export default function WeeklyBarChart<T extends ActivityWeek>({ ariaLabel, compact = false, series, weeks }: Props<T>) {
  const width = compact ? 520 : 920;
  const height = compact ? 200 : 250;
  const margin = compact
    ? { top: 16, right: 12, bottom: 34, left: 34 }
    : { top: 18, right: 16, bottom: 42, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMaximum = roundedMaximum(Math.max(...weeks.map((week) => week.total), 1));
  const slotWidth = plotWidth / weeks.length;
  const barWidth = Math.min(compact ? 18 : 32, slotWidth * 0.68);
  const labelEvery = weeks.length > 14 ? (compact ? 4 : 3) : 2;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full ${compact ? 'min-w-[420px]' : 'min-w-[720px]'}`}
        role="img"
        aria-label={ariaLabel}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = margin.top + plotHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#262626" strokeWidth="1" />
              <text x={margin.left - 7} y={y + 4} textAnchor="end" fill="#737373" fontSize="9">
                {Math.round(yMaximum * ratio)}
              </text>
            </g>
          );
        })}

        {weeks.map((week, index) => {
          const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
          let stackedHeight = 0;
          const details = series
            .map((item) => ({ label: item.label, value: item.value(week) }))
            .filter((item) => item.value > 0)
            .map((item) => `${item.label} ${item.value}`)
            .join(' · ');

          return (
            <g key={week.start}>
              <title>{`${formatWeek(week)}: ${week.total} · ${details}`}</title>
              {series.map((item) => {
                const value = item.value(week);
                const barHeight = (value / yMaximum) * plotHeight;
                const y = margin.top + plotHeight - stackedHeight - barHeight;
                stackedHeight += barHeight;
                return value > 0 ? (
                  <rect key={item.label} x={x} y={y} width={barWidth} height={barHeight} fill={item.color} rx="1" />
                ) : null;
              })}
              {(index % labelEvery === 0 || index === weeks.length - 1) && (
                <text x={x + barWidth / 2} y={height - 14} textAnchor="middle" fill="#737373" fontSize="9">
                  {shortDate(week.start)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function roundedMaximum(maximum: number): number {
  if (maximum <= 10) return 10;
  if (maximum <= 25) return 25;
  if (maximum <= 50) return 50;
  return Math.ceil(maximum / 50) * 50;
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function formatWeek(week: ActivityWeek): string {
  return `${shortDate(week.start)}–${shortDate(week.end)}`;
}
