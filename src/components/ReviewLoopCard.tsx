import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PromptAction } from '../lib/api';
import { copy } from '../lib/format';

type RunState =
  | { id: string; status: 'idle' }
  | { id: string; status: 'running' }
  | { id: string; status: 'done'; message: string }
  | { id: string; status: 'error'; message: string };

export default function ReviewLoopCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['prompt-actions'],
    queryFn: api.promptActions,
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>({ id: '', status: 'idle' });

  const copyPrompt = async (action: PromptAction) => {
    await copy(action.prompt);
    setCopied(action.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const runAction = async (action: PromptAction) => {
    setRunState({ id: action.id, status: 'running' });
    try {
      const response = await api.runPromptAction(action.id);
      setRunState({ id: action.id, status: 'done', message: response.stdout || 'started' });
      await queryClient.invalidateQueries({ queryKey: ['codex-jobs'] });
    } catch (err) {
      setRunState({ id: action.id, status: 'error', message: (err as Error).message });
    }
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300">Review loop</h2>
        <span className="text-[10px] text-neutral-600">
          {data?.canRun ? 'prompt runs enabled' : 'copy-safe mode'}
        </span>
      </header>

      {isLoading ? (
        <p className="text-xs text-neutral-500">loading review actions...</p>
      ) : !data ? (
        <p className="text-xs text-neutral-500">review actions unavailable</p>
      ) : (
        <div className="space-y-2">
          {data.actions.map((action) => {
            const isRunning = runState.id === action.id && runState.status === 'running';
            const isDone = runState.id === action.id && runState.status === 'done';
            const isError = runState.id === action.id && runState.status === 'error';

            return (
              <div key={action.id} className="border border-neutral-800 rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-neutral-200">{action.title}</div>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-500">{action.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => copyPrompt(action)}
                      className="text-xs text-neutral-500 hover:text-neutral-200 transition"
                    >
                      {copied === action.id ? 'copied' : 'copy'}
                    </button>
                    <button
                      onClick={() => runAction(action)}
                      disabled={!action.runnable || isRunning}
                      className="text-xs text-emerald-400 hover:text-emerald-200 transition disabled:text-neutral-700 disabled:hover:text-neutral-700"
                      title={action.runnable ? 'Start background Codex job' : 'Set MC_ENABLE_PROMPT_RUNS=1 to enable'}
                    >
                      {isRunning ? 'starting...' : 'run'}
                    </button>
                  </div>
                </div>
                <div className="mt-2 rounded bg-neutral-950 border border-neutral-800 px-2 py-1.5 font-mono text-[10px] text-neutral-500 break-words">
                  {action.command}
                </div>
                {(isDone || isError) && (
                  <p className={`mt-2 text-[11px] leading-4 ${isError ? 'text-rose-400' : 'text-neutral-400'}`}>
                    {runState.message}
                  </p>
                )}
              </div>
            );
          })}

          {!data.canRun && (
            <p className="text-[11px] leading-4 text-neutral-600">
              Set MC_ENABLE_PROMPT_RUNS=1 to allow these buttons to start whitelisted Codex companion jobs.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
