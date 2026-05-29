import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import HeatmapGrid from '../components/HeatmapGrid';
import TrendChart from '../components/TrendChart';
import { api } from '../api';

export default function HeatmapPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamScores, setTeamScores] = useState<any[]>([]);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamScores(selectedTeam.teamId);
    }
  }, [selectedTeam]);

  async function loadTeams() {
    try {
      setLoading(true);
      const data = await api.getHeatmap();
      setTeams(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamScores(teamId: string) {
    try {
      const data = await api.getTeamScores(teamId);
      setTeamScores(data);
    } catch (err: any) {
      console.error('Failed to load team scores:', err);
    }
  }

  const handleTeamClick = (team: any) => {
    setSelectedTeam(team);
  };

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="skeleton h-6 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton h-4 w-24 mb-3" />
              <div className="skeleton h-8 w-16 mb-3" />
              <div className="skeleton h-2 w-full mb-2" />
              <div className="skeleton h-2 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Team Burnout Heatmap</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Color-coded risk scores for all teams. Click any team to see detailed trends.
          </p>
        </div>
        <button onClick={loadTeams} className="btn-secondary text-xs">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedTeam ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <HeatmapGrid teams={teams} onTeamClick={handleTeamClick} />
        </div>

        {selectedTeam && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm text-[var(--text-primary)]">{selectedTeam.teamName}</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Risk: <span className={`risk-badge risk-badge-${selectedTeam.riskLevel} text-[10px] ml-1`}>{selectedTeam.riskLevel}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <DetailRow label="Composite Score" value={selectedTeam.compositeScore} />
                <DetailRow label="Sentiment" value={selectedTeam.sentimentScore} color="#8b5cf6" />
                <DetailRow label="After Hours" value={selectedTeam.afterHoursScore} color="#f59e0b" />
                <DetailRow label="Latency" value={selectedTeam.latencyScore} color="#06b6d4" />
                <DetailRow label="Vocab Shift" value={selectedTeam.vocabShiftScore} color="#ef4444" />
                <DetailRow label="Unique Members" value={selectedTeam.uniqueMembers} />
              </div>

              <div className="h-40">
                <TrendChart data={teamScores} metric="composite" height={160} />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate(`/trends?teamId=${selectedTeam.teamId}`)}
                  className="btn-primary flex-1 text-xs py-2"
                >
                  Full Trends
                </button>
                <button
                  onClick={() => api.scoreTeam(selectedTeam.teamId).then(() => loadTeamScores(selectedTeam.teamId))}
                  className="btn-secondary text-xs py-2"
                >
                  Score Now
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: number | null; color?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold" style={color ? { color } : {}}>{value}</span>
    </div>
  );
}
