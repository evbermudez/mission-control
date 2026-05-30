import { useState } from 'react';
import { copy } from '../lib/format';

interface Action {
  label: string;
  command: (branch: string) => string;
  note?: string;
}

const actions: Action[] = [
  {
    label: '/claudemd-review',
    command: () => '/claudemd-review',
    note: 'current branch vs origin/staging (Claude)',
  },
  {
    label: '/codex:claudemd-review',
    command: () => '/codex:claudemd-review',
    note: 'same, via Codex (background)',
  },
  {
    label: '/claudemd-review <sha>',
    command: () => '/claudemd-review ',
    note: 'paste a SHA after',
  },
  {
    label: '/codex:review --background',
    command: () => '/codex:review --background',
    note: 'Codex built-in, no CLAUDE.md framing',
  },
  {
    label: '/codex:status',
    command: () => '/codex:status',
    note: 'see in-flight Codex jobs',
  },
];

export default function QuickActionsCard({ currentBranch }: { currentBranch: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const click = async (action: Action) => {
    await copy(action.command(currentBranch));
    setCopied(action.label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">Quick actions</h2>
        <span className="text-[10px] text-neutral-600">click to copy</span>
      </header>
      <ul className="space-y-1.5">
        {actions.map((a) => (
          <li key={a.label}>
            <button
              onClick={() => click(a)}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-neutral-800 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-neutral-200">{a.label}</span>
                <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition">
                  {copied === a.label ? 'copied!' : 'copy'}
                </span>
              </div>
              {a.note && <span className="text-[10px] text-neutral-500">{a.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
