import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import TrendChart from '../components/TrendChart';
import { api } from '../api';

export default function TrendsPage() {
  const [searchParams] = useSearchParams();
  const teamIdParam = searchParams.get('teamId');

  const [teams, setTeams] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(teamIdParam || undefined);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    loadTrends();
  }, [selectedTeamId]);

  useEffect(() => {
    if (selectedTeamId) {
      loadReport(selectedTeamId);
    } else {
      setReport(null);
    }
  }, [selectedTeamId]);

  async function loadTeams() {
    try {
      const data = await api.getHeatmap();
      setTeams(data);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }

  async function loadTrends() {
    try {
      setLoading(true);
      const data = await api.getTrends(selectedTeamId);
      setTrends(data);
    } catch (err) {
      console.error('Failed to load trends:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadReport(teamId: string) {
    try {
      const data = await api.getTeamReport(teamId);
      setReport(data);
    } catch {
      setReport(null);
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Wellbeing Trends</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Track biomarker scores over time. Select a team to view detailed trends and narrative reports.
        </p>
      </div>

      {/* Team selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedTeamId(undefined)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !selectedTeamId
              ? 'bg-brand-500 text-white shadow-sm'
              : 'glass-card text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          All Teams
        </button>
        {teams.map((team: any) => (
          <button
            key={team.teamId}
            onClick={() => setSelectedTeamId(team.teamId)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedTeamId === team.teamId
                ? 'bg-brand-500 text-white shadow-sm'
                : 'glass-card text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {team.teamName}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="skeleton h-4 w-32 mb-4" />
            <div className="skeleton h-[300px] w-full" />
          </div>
        </div>
      ) : (
        <>
          {/* Main trend chart */}
          <GlassCard>
            <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-4">
              {selectedTeamId ? 'All Biomarkers' : 'Composite Score Trend'}
            </h3>
            <TrendChart data={trends} metric={selectedTeamId ? 'all' : 'composite'} height={350} />
          </GlassCard>

          {/* Narrative Report */}
          {report && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--text-primary)]">Pulse Report</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">{report.narrative}</p>

                {report.key_factors?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 uppercase tracking-wider">Key Factors</h4>
                    <div className="flex flex-wrap gap-2">
                      {report.key_factors.map((f: string, i: number) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {report.recommendations?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 uppercase tracking-wider">Recommendations</h4>
                    <ul className="space-y-1.5">
                      {report.recommendations.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* Score table */}
          {trends.length > 0 && (
            <GlassCard>
              <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-4">Score History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="text-left py-2 px-2 text-[var(--text-muted)] font-medium">Period</th>
                      <th className="text-right py-2 px-2 text-[var(--text-muted)] font-medium">Composite</th>
                      <th className="text-right py-2 px-2 text-[var(--text-muted)] font-medium">Sentiment</th>
                      <th className="text-right py-2 px-2 text-[var(--text-muted)] font-medium">After Hours</th>
                      <th className="text-right py-2 px-2 text-[var(--text-muted)] font-medium">Latency</th>
                      <th className="text-right py-2 px-2 text-[var(--text-muted)] font-medium">Vocab</th>
                      <th className="text-right py-2 px-2 text-[var(--text-muted)] font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.slice(0, 20).map((t: any) => (
                      <tr key={t.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors">
                        <td className="py-2 px-2 text-[var(--text-secondary)]">
                          {new Date(t.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="text-right py-2 px-2 font-semibold">{t.composite_score}</td>
                        <td className="text-right py-2 px-2">{t.sentiment_score}</td>
                        <td className="text-right py-2 px-2">{t.after_hours_score}</td>
                        <td className="text-right py-2 px-2">{t.latency_score}</td>
                        <td className="text-right py-2 px-2">{t.vocab_shift_score}</td>
                        <td className="text-right py-2 px-2">
                          <span className={`risk-badge risk-badge-${t.risk_level} text-[10px]`}>{t.risk_level}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
