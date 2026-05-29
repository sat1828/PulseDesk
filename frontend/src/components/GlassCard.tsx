import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function GlassCard({ children, className = '', onClick, hover = true }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 ${hover ? 'hover:shadow-lg' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
