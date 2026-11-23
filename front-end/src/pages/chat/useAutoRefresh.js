import { useEffect, useRef } from 'react'
import { startAutoRefresh } from './conversationState'

const isVisible = () => document.visibilityState !== 'hidden'

// Re-runs refresh every few seconds so new messages from the other student appear
// without reloading. Pauses while the tab is hidden and refreshes as soon as it is
// visible again. Always calls the latest refresh, so it sees current state.
export function useAutoRefresh(refresh, interval = 5000) {
  const latestRefresh = useRef(refresh)
  useEffect(() => {
    latestRefresh.current = refresh
  })

  useEffect(() => {
    const autoRefresh = startAutoRefresh(() => latestRefresh.current(), { interval, isVisible })
    const handleVisibility = () => {
      if (isVisible()) autoRefresh.tick()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      autoRefresh.stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [interval])
}
