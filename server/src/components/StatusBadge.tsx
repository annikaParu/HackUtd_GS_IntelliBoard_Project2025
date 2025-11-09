interface StatusBadgeProps {
  label: string;
  variant?: 'monitoring' | 'ai' | 'active';
  className?: string;
  style?: React.CSSProperties;
}

export default function StatusBadge({ label, variant = 'active', className = '', style }: StatusBadgeProps) {
  return (
    <div className={`status-badge status-badge-${variant} ${className}`} style={style}>
      <span className="status-badge-dot"></span>
      <span>{label}</span>
    </div>
  );
}
