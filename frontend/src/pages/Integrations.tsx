import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import { useIntegrations } from '../hooks/useIntegrations';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function IntegrationsPage() {
  const { integrations, loading, error, slackConnected, refetch, deleteIntegration } = useIntegrations();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<{ apiUrl: string; slackClientId: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    handleUrlParams();
  }, []);

  async function loadConfig() {
    try {
      const c = await api.getConfig();
      setConfig(c);
    } catch {
      // fallback
    }
  }

  function handleUrlParams() {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success === 'slack') {
      toast.success('Slack workspace connected successfully!');
      refetch();
    } else if (errorParam === 'slack_denied') {
      toast.error('Slack authorization was denied.');
    } else if (errorParam === 'invalid_state') {
      toast.error('OAuth state validation failed. Please try again.');
    } else if (errorParam === 'slack_auth_failed') {
      toast.error('Slack authentication failed. Check your credentials.');
    }
  }

  async function handleDisconnect(id: string) {
    setDisconnecting(id);
    try {
      await deleteIntegration(id);
      toast.success('Integration disconnected');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  }

  const slackIntegration = integrations.find((i: any) => i.provider === 'slack');

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Integrations</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Connect PulseDesk to your communication tools for passive wellbeing monitoring.
        </p>
      </div>

      {/* Slack */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#4A154B] flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.5 15.5a2 2 0 01-2 2c-1.1 0-2-.9-2-2s.9-2 2-2h2v2zm0 0h-2v2c0 1.1.9 2 2 2s2-.9 2-2v-2h-2z"/>
                <path d="M12 15.5a2 2 0 01-2 2c-1.1 0-2-.9-2-2s.9-2 2-2h2v2zm0 0h-2v2c0 1.1.9 2 2 2s2-.9 2-2v-2h-2z"/>
                <path d="M17.5 6.5a2 2 0 012-2c1.1 0 2 .9 2 2s-.9 2-2 2h-2v-2zm0 0h2v-2c0-1.1-.9-2-2-2s-2 .9-2 2v2h2z"/>
                <path d="M12 6.5a2 2 0 012-2c1.1 0 2 .9 2 2s-.9 2-2 2h-2v-2zm0 0h2v-2c0-1.1-.9-2-2-2s-2 .9-2 2v2h2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">Slack</h3>
                {slackConnected && (
                  <span className="risk-badge risk-badge-low text-[10px]">Connected</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-1">
                {slackConnected
                  ? `Connected to ${slackIntegration?.workspace_name || 'Slack'}`
                  : 'Connect PulseDesk to your Slack workspace for message metadata ingestion.'}
              </p>
              {slackConnected && slackIntegration?.last_sync_at && (
                <p className="text-[10px] text-[var(--text-muted)]">
                  Last synced: {new Date(slackIntegration.last_sync_at).toLocaleString()}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                {slackConnected ? (
                  <button
                    onClick={() => handleDisconnect(slackIntegration.id)}
                    disabled={disconnecting === slackIntegration.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg px-3 py-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                  >
                    {disconnecting === slackIntegration.id ? (
                      <span className="spinner !w-3 !h-3 !border-red-300 !border-t-red-500" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {disconnecting === slackIntegration.id ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <a
                    href="/api/integrations/slack/connect"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Microsoft Teams (placeholder) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#6264A7] flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="8" width="10" height="10" rx="2" />
                <rect x="12" y="4" width="8" height="8" rx="1.5" />
                <circle cx="18" cy="5" r="2" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">Microsoft Teams</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-medium">Coming Soon</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Integrate with Microsoft Teams and Outlook Calendar for meeting load analysis and communication metadata.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Connected integrations list */}
      {integrations.length > 0 && (
        <GlassCard>
          <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Connected Integrations</h3>
          <div className="space-y-2">
            {integrations.map((int: any) => (
              <div key={int.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${int.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{int.provider}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {int.workspace_name || 'Unknown workspace'}
                      {int.last_sync_at && ` · Last sync: ${new Date(int.last_sync_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {int.is_active && (
                    <button
                      onClick={() => handleDisconnect(int.id)}
                      className="text-xs px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
