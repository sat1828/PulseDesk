import { motion } from 'framer-motion';

interface TeamScore {
  teamId: string;
  teamName: string;
  slackChannelName?: string;
  compositeScore: number | null;
  riskLevel: string;
  sentimentScore: number | null;
  afterHoursScore: number | null;
  latencyScore: number | null;
  vocabShiftScore: number | null;
  uniqueMembers: number;
  isSustained: boolean;
  lastUpdated: string | null;
}

interface HeatmapGridProps {
  teams: TeamScore[];
  onTeamClick?: (team: TeamScore) => void;
}

function getRiskColor(score: number | null): string {
  if (score === null) return '#6b7280';
  if (score >= 70) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#22c55e';
}

function getRiskBg(score: number | null): string {
  if (score === null) return 'bg-gray-100 dark:bg-gray-800';
  if (score >= 70) return 'bg-red-50 dark:bg-red-900/20';
  if (score >= 50) return 'bg-orange-50 dark:bg-orange-900/20';
  if (score >= 30) return 'bg-yellow-50 dark:bg-yellow-900/20';
  return 'bg-green-50 dark:bg-green-900/20';
}

export default function HeatmapGrid({ teams, onTeamClick }: HeatmapGridProps) {
  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-muted)]">No team data available yet. Connect a Slack workspace to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}
    >
      {teams.map((team, index) => (
        <motion.div
          key={team.teamId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.4 }}
          onClick={() => onTeamClick?.(team)}
          className={`glass-card p-4 cursor-pointer relative overflow-hidden ${getRiskBg(team.compositeScore)}`}
        >
          <div
            className="absolute top-0 right-0 w-1 h-full"
            style={{ backgroundColor: getRiskColor(team.compositeScore) }}
          />
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">{team.teamName}</h3>
              {team.slackChannelName && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">#{team.slackChannelName}</p>
              )}
            </div>
            <span className={`risk-badge risk-badge-${team.riskLevel} text-[10px]`}>
              {team.riskLevel === 'insufficient_data' ? 'No Data' : team.riskLevel}
            </span>
          </div>

          {team.compositeScore !== null && (
            <>
              <div className="flex items-end gap-2 mb-3">
                <span className="stat-value text-2xl">{team.compositeScore}</span>
                <span className="text-xs text-[var(--text-muted)] mb-1">/100</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ScoreBar label="Sentiment" value={team.sentimentScore} color="#4c6ef5" />
                <ScoreBar label="After Hours" value={team.afterHoursScore} color="#f59e0b" />
                <ScoreBar label="Latency" value={team.latencyScore} color="#8b5cf6" />
                <ScoreBar label="Vocab Shift" value={team.vocabShiftScore} color="#06b6d4" />
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-color)]">
                <span className="text-[11px] text-[var(--text-muted)]">
                  {team.uniqueMembers} members
                </span>
                {team.isSustained && (
                  <span className="text-[11px] font-medium text-red-500 dark:text-red-400">
                    Sustained
                  </span>
                )}
              </div>
            </>
          )}

          {team.compositeScore === null && (
            <div className="py-4 text-center">
              <p className="text-xs text-[var(--text-muted)]">Insufficient data. Need at least 5 members with 2+ weeks of activity.</p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="font-medium text-[var(--text-secondary)]">{v}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${v}%`, backgroundColor: color, opacity: v > 0 ? 0.8 : 0.3 }}
        />
      </div>
    </div>
  );
}
