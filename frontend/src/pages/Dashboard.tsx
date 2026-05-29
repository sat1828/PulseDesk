import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import HeatmapGrid from '../components/HeatmapGrid';
import TrendChart from '../components/TrendChart';
import { api } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [s, h, t] = await Promise.all([
        api.getSummary(),
        api.getHeatmap(),
        api.getTrends(),
      ]);
      setSummary(s);
      setHeatmap(h);
      setTrends(t);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton h-4 w-20 mb-3" />
              <div className="skeleton h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="glass-card p-5">
          <div className="skeleton h-4 w-32 mb-4" />
          <div className="skeleton h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <button onClick={loadData} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  const highRiskTeams = heatmap.filter(t => t.riskLevel === 'high' || t.riskLevel === 'elevated');
  const needsAttention = heatmap.filter(t => t.isSustained);

  return (
    <div className="space-y-6 page-enter">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Teams Monitored</p>
          <p className="stat-value text-left">{summary?.totalTeams || 0}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{summary?.scoredTeams || 0} with active scores</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg Composite Score</p>
          <p className="stat-value text-left">{summary?.averageCompositeScore ?? '—'}</p>
          <p className={`text-xs mt-1 ${(summary?.averageCompositeScore ?? 0) > 50 ? 'text-orange-500' : 'text-green-500'}`}>
            {(summary?.averageCompositeScore ?? 0) > 50 ? 'Needs attention' : 'Healthy'}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">At Risk Teams</p>
          <p className={`stat-value text-left ${highRiskTeams.length > 0 ? '!bg-gradient-to-r !from-orange-500 !to-red-500 !bg-clip-text' : ''}`}>
            {highRiskTeams.length}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {highRiskTeams.length > 0 ? `${highRiskTeams.length} team${highRiskTeams.length > 1 ? 's' : ''} need${highRiskTeams.length === 1 ? 's' : ''} attention` : 'All teams healthy'}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Unresolved Alerts</p>
          <p className={`stat-value text-left ${(summary?.unresolvedAlerts || 0) > 0 ? '!bg-gradient-to-r !from-red-500 !to-rose-500 !bg-clip-text' : ''}`}>
            {summary?.unresolvedAlerts || 0}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {(summary?.unresolvedAlerts || 0) > 0 ? 'Requires action' : 'All clear'}
          </p>
        </GlassCard>
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <GlassCard className="border-l-4 border-l-orange-500">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">Sustained Risk Detected</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {needsAttention.length} team{needsAttention.length > 1 ? 's' : ''} ha{needsAttention.length === 1 ? 's' : 've'} been in elevated/high risk for multiple consecutive weeks.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {needsAttention.map((t: any) => (
                  <button
                    key={t.teamId}
                    onClick={() => navigate(`/trends?teamId=${t.teamId}`)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors"
                  >
                    {t.teamName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Trend Chart */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">Organization Trend</h3>
          <button onClick={() => navigate('/trends')} className="text-xs text-brand-500 hover:text-brand-600 font-medium">
            View all →
          </button>
        </div>
        <TrendChart data={trends} metric="composite" />
      </GlassCard>

      {/* Heatmap */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">Team Heatmap</h3>
          <button onClick={() => navigate('/heatmap')} className="text-xs text-brand-500 hover:text-brand-600 font-medium">
            View all →
          </button>
        </div>
        <HeatmapGrid teams={heatmap} onTeamClick={(team) => navigate(`/trends?teamId=${team.teamId}`)} />
      </div>
    </div>
  );
}
