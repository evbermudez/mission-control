import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import BranchesCard from './components/BranchesCard';
import PrsCard from './components/PrsCard';
import CommitActivityCard from './components/CommitActivityCard';
import CustomSkillsCard from './components/CustomSkillsCard';
import ArchimedesVaultCard from './components/ArchimedesVaultCard';

export default function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Mission Control</h1>
        <div className="text-xs text-neutral-500 font-mono">
          {health.data ? (
            <>
              <span className="text-neutral-300">{health.data.branch || '(detached)'}</span>
              {' · '}
              <span>{health.data.repo}</span>
            </>
          ) : (
            <span>loading…</span>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <PrsCard />
          <CommitActivityCard />
          <BranchesCard currentBranch={health.data?.branch ?? ''} />
        </div>
        <div className="flex flex-col gap-4">
          <ArchimedesVaultCard />
          <CustomSkillsCard />
        </div>
      </main>
    </div>
  );
}
