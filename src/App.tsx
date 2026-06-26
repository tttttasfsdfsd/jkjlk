import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'

// P3-17: Route-based lazy loading — Home is the main heavy component
// Each lazy import becomes a separate chunk that only loads when the route renders
const Home = lazy(() => import('./pages/Home'))

// Loading fallback shown while chunk loads
function PageSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{
        width: '40px', height: '40px', border: '3px solid #e5e7eb',
        borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Suspense>
  )
}
