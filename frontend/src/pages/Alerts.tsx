import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import { api } from '../api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnresolved, setShowUnresolved] = useState(true);

  useEffect(() => { loadAlerts(); }, [showUnresolved]);

  async function loadAlerts() {
    try {
      setLoading(true);
      const data = await api.getAlerts(undefined, showUnresolved || undefined);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id: string) {
    try {
      await api.resolveAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  }

  function getAlertIcon(type: string) {
    switch (type) {
      case 'sustained_burnout_risk': return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z';
      case 'burnout_risk': return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default: return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Alerts</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''} {showUnresolved ? 'awaiting attention' : 'in total'}
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-[var(--text-muted)]">Show unresolved only</span>
          <div
            onClick={() => setShowUnresolved(!showUnresolved)}
            className={`relative w-9 h-5 rounded-full transition-colors ${showUnresolved ? 'bg-brand-500' : 'bg-[var(--bg-tertiary)]'}`}
          >
            <div className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all ${showUnresolved ? 'left-[18px]' : 'left-[2px]'}`} />
          </div>
        </label>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-4">
              <div className="skeleton h-4 w-48 mb-2" />
              <div className="skeleton h-3 w-64" />
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <GlassCard>
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">All clear</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">No alerts to show right now.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.03 }}
              >
                <GlassCard className={`border-l-4 ${alert.severity === 'critical' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      alert.severity === 'critical'
                        ? 'bg-red-100 dark:bg-red-900/20'
                        : 'bg-orange-100 dark:bg-orange-900/20'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        alert.severity === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={getAlertIcon(alert.alert_type)} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`risk-badge text-[10px] ${alert.severity === 'critical' ? 'risk-badge-high' : 'risk-badge-elevated'}`}>
                          {alert.severity}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)]">{alert.message}</p>
                    </div>
                    {!alert.is_resolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 font-medium hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors flex-shrink-0"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
