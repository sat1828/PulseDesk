import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getIntegrations();
      setIntegrations(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const deleteIntegration = useCallback(async (id: string) => {
    try {
      await api.deleteIntegration(id);
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const slackConnected = integrations.some(i => i.provider === 'slack' && i.is_active);

  return { integrations, loading, error, slackConnected, refetch: fetchIntegrations, deleteIntegration };
}
