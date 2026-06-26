@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Tajawal:wght@300;400;500;700;800;900&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 30% 4%;
    --foreground: 220 20% 94%;
    --card: 220 28% 8%;
    --card-foreground: 220 20% 94%;
    --popover: 220 28% 8%;
    --popover-foreground: 220 20% 94%;
    --primary: 230 85% 62%;
    --primary-foreground: 0 0% 100%;
    --secondary: 187 94% 43%;
    --secondary-foreground: 0 0% 100%;
    --muted: 220 20% 16%;
    --muted-foreground: 215 16% 57%;
    --accent: 262 83% 58%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 215 25% 18%;
    --input: 215 25% 18%;
    --ring: 230 85% 62%;
    --radius: 0.75rem;

    --bg-deep: #050B14;
    --bg-card: #0B1426;
    --bg-elevated: #111D32;
    --bg-hover: #1A2A42;
    --accent-primary: #4F6AF6;
    --accent-secondary: #06B6D4;
    --accent-tertiary: #8B5CF6;
    --accent-success: #10B981;
    --accent-warning: #F59E0B;
    --accent-danger: #EF4444;
    --text-primary: #E8EDF6;
    --text-secondary: #8896AB;
    --text-muted: #5A6A82;
    --border-color: #1E2D45;
  }

  * {
    @apply border-[var(--border-color)];
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: 'Inter', 'Tajawal', sans-serif;
    background: var(--bg-deep);
    color: var(--text-primary);
    min-height: 100vh;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: var(--bg-deep);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--accent-primary);
  }
}

@layer components {
  .gradient-text {
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gradient-primary {
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  }

  .card-hover {
    transition: all 0.3s ease;
  }
  .card-hover:hover {
    transform: translateY(-4px);
    border-color: var(--accent-primary);
    box-shadow: 0 8px 32px rgba(79, 106, 246, 0.12);
  }

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    padding: 1.25rem;
    transition: all 0.3s ease;
  }
  .metric-card:hover {
    transform: translateY(-4px);
    border-color: var(--accent-primary);
    box-shadow: 0 8px 32px rgba(79, 106, 246, 0.12);
  }

  .section-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    overflow: hidden;
  }

  .section-header {
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .section-header:hover {
    background: var(--bg-elevated);
  }

  .section-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.4s ease-out, opacity 0.3s ease;
    opacity: 0;
  }
  .section-content.expanded {
    max-height: 2000px;
    opacity: 1;
    padding: 1rem 1.25rem;
  }

  .upload-area {
    border: 3px dashed var(--border-color);
    transition: all 0.4s ease;
    cursor: pointer;
  }
  .upload-area:hover,
  .upload-area.dragover {
    border-color: var(--accent-primary);
    background: rgba(79, 106, 246, 0.05);
    transform: translateY(-4px);
    box-shadow: 0 0 30px rgba(79, 106, 246, 0.15);
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.08;
    pointer-events: none;
  }

  .score-ring-progress {
    transition: stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bar-fill {
    transition: width 1.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .chart-container {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease-out, transform 0.6s ease-out;
  }
  .chart-container.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .mono {
    font-family: 'JetBrains Mono', monospace;
  }

  .insight-card {
    background: var(--bg-deep);
    border-radius: 0.75rem;
    padding: 1rem;
    border-right: 4px solid var(--accent-primary);
  }
  .insight-card.risk {
    border-right-color: var(--accent-danger);
  }
  .insight-card.opportunity {
    border-right-color: var(--accent-success);
  }
  .insight-card.recommendation {
    border-right-color: var(--accent-warning);
  }
}

@layer utilities {
  .text-success { color: var(--accent-success); }
  .text-warning { color: var(--accent-warning); }
  .text-danger { color: var(--accent-danger); }
  .text-primary-accent { color: var(--accent-primary); }
  .text-secondary-accent { color: var(--accent-secondary); }
  .bg-success-alpha { background: rgba(16, 185, 129, 0.15); }
  .bg-warning-alpha { background: rgba(245, 158, 11, 0.15); }
  .bg-danger-alpha { background: rgba(239, 68, 68, 0.15); }
  .bg-primary-alpha { background: rgba(79, 106, 246, 0.15); }
  .bg-secondary-alpha { background: rgba(6, 182, 212, 0.15); }
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}

@keyframes spin-loader {
  to { transform: rotate(360deg); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes countUp {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
}

.animate-fadeInUp {
  animation: fadeInUp 0.8s ease-out forwards;
}

.animate-spin-loader {
  animation: spin-loader 1s linear infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 2s infinite;
}
