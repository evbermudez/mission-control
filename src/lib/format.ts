export function aheadBehindLabel(ahead: number, behind: number): string {
  if (ahead === 0 && behind === 0) return '✓';
  const parts: string[] = [];
  if (ahead > 0) parts.push(`↑${ahead}`);
  if (behind > 0) parts.push(`↓${behind}`);
  return parts.join(' ');
}

export function aheadBehindClass(ahead: number, behind: number): string {
  if (ahead === 0 && behind === 0) return 'text-emerald-400';
  if (behind > 0 && ahead > 0) return 'text-amber-400';
  if (behind > 0) return 'text-sky-400';
  return 'text-violet-400';
}

export function statusEmoji(rollup: 'PASS' | 'PENDING' | 'FAIL' | 'NONE'): string {
  return { PASS: '✅', PENDING: '🟡', FAIL: '❌', NONE: '·' }[rollup];
}

export function timeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export async function copy(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
