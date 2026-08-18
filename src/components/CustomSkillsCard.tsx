import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { copy } from '../lib/format';

export default function CustomSkillsCard() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['skills'],
    queryFn: api.skills,
  });

  const visibleSkills = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(needle));
  }, [data, query]);

  const copySkill = async (name: string) => {
    await copy(`$${name}`);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">Custom skills</h2>
        <span className="text-[10px] text-neutral-600">{data.length}</span>
      </header>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search skills…"
        aria-label="Search custom skills"
        className="mb-3 w-full rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
      />

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading skills…</p>
      ) : isError ? (
        <p className="text-xs text-red-300">could not load skills</p>
      ) : visibleSkills.length === 0 ? (
        <p className="text-xs text-neutral-500">{query ? 'no matching skills' : 'no custom skills found'}</p>
      ) : (
        <ul className="space-y-1">
          {visibleSkills.map((skill) => (
            <li key={skill.name}>
              <button
                type="button"
                onClick={() => copySkill(skill.name)}
                title={skill.description || `Copy $${skill.name}`}
                className="group w-full rounded-md px-2 py-2 text-left transition hover:bg-neutral-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-neutral-200">${skill.name}</span>
                  <span className="shrink-0 text-[10px] text-emerald-400 opacity-0 transition group-hover:opacity-100">
                    {copied === skill.name ? 'copied' : 'copy'}
                  </span>
                </div>
                {skill.description && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-neutral-500">{skill.description}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
