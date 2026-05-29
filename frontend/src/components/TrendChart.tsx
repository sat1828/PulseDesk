import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from 'recharts';

interface TrendData {
  period_end: string;
  composite_score?: number;
  sentiment_score?: number;
  after_hours_score?: number;
  latency_score?: number;
  vocab_shift_score?: number;
  team_name?: string;
}

interface TrendChartProps {
  data: TrendData[];
  metric?: 'composite' | 'all';
  height?: number;
}

const COLORS = {
  composite: '#4c6ef5',
  sentiment: '#8b5cf6',
  afterHours: '#f59e0b',
  latency: '#06b6d4',
  vocabShift: '#ef4444',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-glass">
      <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--text-secondary)]">{entry.name}:</span>
          <span className="font-semibold text-[var(--text-primary)]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({ data, metric = 'composite', height = 300 }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-[var(--text-muted)]">No trend data available</p>
      </div>
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.period_end).getTime() - new Date(b.period_end).getTime()
  );

  const chartData = sorted.map(d => ({
    date: d.period_end,
    'Composite Score': d.composite_score,
    Sentiment: d.sentiment_score,
    'After Hours': d.after_hours_score,
    Latency: d.latency_score,
    'Vocab Shift': d.vocab_shift_score,
  }));

  if (metric === 'composite') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="compositeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.composite} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COLORS.composite} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="Composite Score"
            stroke={COLORS.composite}
            strokeWidth={2}
            fill="url(#compositeGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          axisLine={false}
          tickLine={false}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)' }}
          iconType="circle"
          iconSize={8}
        />
        <Line type="monotone" dataKey="Sentiment" stroke={COLORS.sentiment} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="After Hours" stroke={COLORS.afterHours} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Latency" stroke={COLORS.latency} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Vocab Shift" stroke={COLORS.vocabShift} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
