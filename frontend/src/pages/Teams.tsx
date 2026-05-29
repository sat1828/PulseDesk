import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import { api } from '../api';

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', slackChannelId: '', slackChannelName: '' });
  const [creating, setCreating] = useState(false);
  const [scoringTeam, setScoringTeam] = useState<string | null>(null);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    try {
      setLoading(true);
      const data = await api.getTeams();
      setTeams(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newTeam.name) return;
    setCreating(true);
    try {
      await api.createTeam(newTeam);
      setShowCreate(false);
      setNewTeam({ name: '', slackChannelId: '', slackChannelName: '' });
      await loadTeams();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleScoreNow(teamId: string) {
    setScoringTeam(teamId);
    try {
      await api.scoreTeam(teamId);
      await loadTeams();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScoringTeam(null);
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Teams</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {teams.length} team{teams.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-xs">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Team
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassCard>
              <form onSubmit={handleCreate} className="space-y-4">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">New Team</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Team Name *</label>
                    <input
                      type="text"
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                      className="input-glass"
                      placeholder="Platform Engineering"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Slack Channel ID</label>
                    <input
                      type="text"
                      value={newTeam.slackChannelId}
                      onChange={(e) => setNewTeam({ ...newTeam, slackChannelId: e.target.value })}
                      className="input-glass"
                      placeholder="C0123ABC456"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Channel Name</label>
                    <input
                      type="text"
                      value={newTeam.slackChannelName}
                      onChange={(e) => setNewTeam({ ...newTeam, slackChannelName: e.target.value })}
                      className="input-glass"
                      placeholder="platform-eng"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
                  <button type="submit" disabled={creating} className="btn-primary text-xs">
                    {creating ? 'Creating...' : 'Create Team'}
                  </button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton h-4 w-32 mb-3" />
              <div className="skeleton h-3 w-20 mb-4" />
              <div className="skeleton h-8 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team, index) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GlassCard>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--text-primary)]">{team.name}</h3>
                    {team.slack_channel_name && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">#{team.slack_channel_name}</p>
                    )}
                  </div>
                  <span className={`w-2 h-2 rounded-full ${team.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="text-xs text-[var(--text-muted)] mb-3">
                  {team.slack_channel_id ? 'Slack connected' : 'No Slack channel mapped'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScoreNow(team.id)}
                    disabled={scoringTeam === team.id}
                    className="btn-primary text-xs flex-1 py-2"
                  >
                    {scoringTeam === team.id ? (
                      <span className="spinner !w-3 !h-3 !border-white/30 !border-t-white" />
                    ) : (
                      'Score Now'
                    )}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
