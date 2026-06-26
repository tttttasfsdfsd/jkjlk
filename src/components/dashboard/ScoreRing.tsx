interface ScoreRingProps {
  score: number;
  size?: number;
}

export default function ScoreRing({ score, size = 144 }: ScoreRingProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx="50" cy="50" r={radius} fill="none"
          stroke="url(#scoreGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring-progress"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F6AF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>{score}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/100</span>
      </div>
    </div>
  );
}
