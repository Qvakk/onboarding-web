const SESSION_CONFIG = {
  WARNING_THRESHOLD: 0.9,
  CHECK_INTERVAL: 30000,
  STORAGE_KEY: 'session_info',
  ADMIN_SESSION_KEY: 'admin_session_info',
  ADMIN_SESSION_TOKEN_KEY: 'admin_session_token', // NEW: Session token storage
  ADMIN_SESSION_EXPIRES_KEY: 'admin_session_expires', // NEW: Expiry timestamp
  ADMIN_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  ADMIN_WARNING_MS: 27 * 60 * 1000  // 27 minutes (90% of 30 minutes)
}

// Admin routes that require session management
const ADMIN_ROUTES = ['/admin', '/debug', '/stats']

// Cache keys for admin data
const CACHE_KEYS = {
  DEBUG_LOGS: 'admin_debug_logs',
  DEBUG_LOGS_TIMESTAMP: 'admin_debug_logs_timestamp',
  STATS_DATA: 'admin_stats_data',
  STATS_DATA_TIMESTAMP: 'admin_stats_data_timestamp'
}

// Cache duration (30 minutes)
const CACHE_DURATION_MS = 30 * 60 * 1000

class SessionManager {
  constructor() {
    this.sessionTimeout = null
    this.sessionWarning = null
    this.warningShown = false
    this.intervalId = null
    this.onTimeoutCallback = null
    this.onWarningCallback = null
    
    this.init()
  }

  init() {
    if (typeof window === 'undefined') return
    
    this.startMonitoring()
    this.setupActivityListeners()
  }

  startMonitoring() {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.checkSessionStatus()
    }, SESSION_CONFIG.CHECK_INTERVAL)
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  checkSessionStatus() {
    if (typeof sessionStorage === 'undefined') return
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname
    const isAdminPage = ADMIN_ROUTES.includes(pathname)

    if (isAdminPage) {
      // Check admin session timeout (30 minutes of inactivity)
      this.checkAdminSession(pathname)
    } else {
      // Check regular user verification session timeout
      this.checkUserSession()
    }
  }

  checkAdminSession(pathname) {
    const adminSessionInfo = sessionStorage.getItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
    
    // If on /debug or /stats but no admin session, check if we're in OAuth callback flow
    if ((pathname === '/debug' || pathname === '/stats') && !adminSessionInfo) {
      // Check if page is currently loading (OAuth callback in progress)
      // Don't redirect if we're in the middle of authentication
      const isLoading = sessionStorage.getItem('admin_auth_in_progress')
      
      if (!isLoading) {
        window.location.href = '/admin'
      }
      return
    }

    if (!adminSessionInfo) return

    try {
      const { loginTime, lastActivity } = JSON.parse(adminSessionInfo)
      const now = Date.now()
      const elapsed = now - lastActivity  // Changed from loginTime to lastActivity for inactivity timeout

      // Timeout after 30 minutes of inactivity
      if (elapsed >= SESSION_CONFIG.ADMIN_TIMEOUT_MS) {
        this.handleAdminSessionTimeout()
        return
      }

      // Show warning at 27 minutes of inactivity (90% of 30 minutes)
      if (elapsed >= SESSION_CONFIG.ADMIN_WARNING_MS && !this.warningShown) {
        const timeLeft = SESSION_CONFIG.ADMIN_TIMEOUT_MS - elapsed
        this.handleAdminSessionWarning(timeLeft)
      }

      // Auto-refresh lastActivity on user interaction (handled by activity listeners)
    } catch (error) {
      console.error('Admin session check error:', error)
      sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
    }
  }

  checkUserSession() {
    // CRITICAL: Double-check we're not on an admin page
    // This prevents race conditions where checkSessionStatus routes incorrectly
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname
      const isAdminPage = pathname === '/admin' || pathname === '/debug' || pathname === '/stats' || pathname === '/entravalidationcallback'
      if (isAdminPage) {
        return
      }
    }

    // Clear any lingering admin session data when on user pages
    if (sessionStorage.getItem(SESSION_CONFIG.ADMIN_SESSION_KEY)) {
      sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
    }

    const sessionInfo = sessionStorage.getItem(SESSION_CONFIG.STORAGE_KEY)
    if (!sessionInfo) return

    try {
      const { timeout, warning, lastUpdate } = JSON.parse(sessionInfo)
      const elapsed = Date.now() - lastUpdate
      
      if (elapsed >= timeout) {
        this.handleSessionTimeout()
        return
      }
      
      if (elapsed >= warning && !this.warningShown) {
        this.handleSessionWarning(timeout - elapsed)
      }
    } catch (error) {
      console.error('Session check error:', error)
    }
  }

  handleAdminSessionTimeout() {
    this.warningShown = false
    
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
      // ✅ SECURITY: Clear all cached data on session timeout
      this.clearAllAdminCache()
    }

    if (typeof window !== 'undefined') {
      alert('Din admin-sesjon har utløpt etter 30 minutter inaktivitet. Du må logge inn på nytt.\n\nYour admin session has expired after 30 minutes of inactivity. Please login again.')
      window.location.href = '/admin'
    }
  }
  
  /**
   * Called on logout, session timeout, or session change
   * Prevents stale data access after OAuth revocation
   */
  clearAllAdminCache() {
    if (typeof sessionStorage === 'undefined') return
    
    // Remove all cache entries (keys starting with 'cache_' or 'admin_')
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (key.startsWith('cache_') || key.startsWith('admin_'))) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key)
    })
  }
  
  /**
   * ✅ SECURITY: Generate cache key bound to session token
   * Cache invalidated automatically when session changes
   * @param {string} dataType - Type of data (e.g., 'logs', 'stats')
   * @param {string} identifier - Unique identifier (e.g., correlationId)
   * @returns {string|null} Cache key or null if no session
   */
  generateCacheKey(dataType, identifier) {
    const sessionToken = this.getAdminSessionToken()
    if (!sessionToken) return null
    
    // Bind cache to session token (first 8 chars for readability)
    const sessionHash = sessionToken.substring(0, 8)
    return `cache_${sessionHash}_${dataType}_${identifier}`
  }

  handleAdminSessionWarning(timeLeft) {
    this.warningShown = true
    const minutes = Math.floor(timeLeft / 60000)
    const seconds = Math.floor((timeLeft % 60000) / 1000)
    console.warn(`Admin session will expire in ${minutes}:${seconds.toString().padStart(2, '0')}`)
    
    // Optional: Show a subtle notification to the user
    if (this.onWarningCallback) {
      this.onWarningCallback(Math.floor(timeLeft / 1000))
    }
  }

  // Generate a fingerprint for session validation (basic tamper detection)
  generateSessionFingerprint() {
    if (typeof window === 'undefined') return null
    
    // Combine stable browser characteristics (excluding screen dimensions that can change with zoom/resize)
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      // screen.width + 'x' + screen.height, // Removed - too unstable (changes with zoom, window resize)
      new Date().getTimezoneOffset()
    ].join('|')
    
    // Simple hash (not cryptographically secure, but prevents casual tampering)
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  // Call this when admin successfully logs in (from /debug or /stats page)
  // NEW: Now also stores session token from backend
  startAdminSession(sessionToken = null, expiresAt = null) {
    if (typeof sessionStorage === 'undefined') return
    
    // CRITICAL: Clear any old session data when starting new admin session
    sessionStorage.removeItem(SESSION_CONFIG.STORAGE_KEY) // Remove user session data
    sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_KEY) // Remove old admin session
    sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_TOKEN_KEY) // Remove old token
    sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_EXPIRES_KEY) // Remove old expiry
    
    // ✅ SECURITY: Clear all cached data from previous session
    this.clearAllAdminCache()
    
    const fingerprint = this.generateSessionFingerprint()
    const adminSessionInfo = {
      loginTime: Date.now(),
      lastActivity: Date.now(),
      fp: fingerprint // Fingerprint for basic tamper detection
    }
    
    sessionStorage.setItem(SESSION_CONFIG.ADMIN_SESSION_KEY, JSON.stringify(adminSessionInfo))
    
    // NEW: Store session token if provided (from backend after OAuth)
    if (sessionToken) {
      sessionStorage.setItem(SESSION_CONFIG.ADMIN_SESSION_TOKEN_KEY, sessionToken)
    }
    
    // NEW: Store expiry timestamp if provided
    if (expiresAt) {
      sessionStorage.setItem(SESSION_CONFIG.ADMIN_SESSION_EXPIRES_KEY, expiresAt.toString())
    }
    
    sessionStorage.removeItem('admin_auth_in_progress') // Clear loading flag
    this.warningShown = false
  }
  
  // NEW: Get session token for API calls
  getAdminSessionToken() {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage.getItem(SESSION_CONFIG.ADMIN_SESSION_TOKEN_KEY)
  }
  
  // Get cache configuration (for debug logs and stats data)
  getCacheConfig() {
    return {
      keys: CACHE_KEYS,
      duration: CACHE_DURATION_MS
    }
  }
  
  // NEW: Check if session token needs refresh
  needsSessionRefresh() {
    if (typeof sessionStorage === 'undefined') return false
    
    const expiresAt = sessionStorage.getItem(SESSION_CONFIG.ADMIN_SESSION_EXPIRES_KEY)
    if (!expiresAt) return false
    
    const expiryTime = parseInt(expiresAt)
    const now = Date.now()
    const timeUntilExpiry = expiryTime - now
    
    // Refresh if less than 5 minutes remaining
    return timeUntilExpiry < 5 * 60 * 1000
  }

  // Check if there's a valid admin session (not expired)
  hasValidAdminSession() {
    if (typeof sessionStorage === 'undefined') return false
    
    const adminSessionInfo = sessionStorage.getItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
    if (!adminSessionInfo) return false
    
    try {
      const { loginTime, lastActivity, fp } = JSON.parse(adminSessionInfo)
      
      // Verify fingerprint to detect tampering
      const currentFp = this.generateSessionFingerprint()
      if (fp && fp !== currentFp) {
        console.warn('[SessionManager] Session fingerprint mismatch - possible tampering detected')
        sessionStorage.removeItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
        return false
      }
      
      const elapsed = Date.now() - lastActivity
      
      // Session is valid if less than 30 minutes since last activity
      return elapsed < SESSION_CONFIG.ADMIN_TIMEOUT_MS
    } catch (error) {
      console.error('Error checking admin session validity:', error)
      return false
    }
  }

  // Call this on user activity to update lastActivity timestamp
  refreshAdminSession() {
    if (typeof sessionStorage === 'undefined') return
    if (typeof window === 'undefined') return
    
    const pathname = window.location.pathname
    const isAdminPage = pathname === '/admin' || pathname === '/debug' || pathname === '/stats'
    
    if (!isAdminPage) return

    const adminSessionInfo = sessionStorage.getItem(SESSION_CONFIG.ADMIN_SESSION_KEY)
    if (!adminSessionInfo) return

    try {
      const parsed = JSON.parse(adminSessionInfo)
      parsed.lastActivity = Date.now()
      sessionStorage.setItem(SESSION_CONFIG.ADMIN_SESSION_KEY, JSON.stringify(parsed))
      this.warningShown = false // Reset warning if user is active
    } catch (error) {
      console.error('Failed to refresh admin session:', error)
    }
  }

  handleSessionTimeout() {
    this.stopMonitoring()
    
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_CONFIG.STORAGE_KEY)
      sessionStorage.removeItem('verification_state')
      sessionStorage.removeItem('correlation_id')
      sessionStorage.removeItem('user_type')
      sessionStorage.removeItem('current_step')
      const savedLocale = sessionStorage.getItem('locale')
      sessionStorage.clear()
      if (savedLocale) {
        sessionStorage.setItem('locale', savedLocale)
      }
    }
    
    if (this.onTimeoutCallback) {
      this.onTimeoutCallback()
    } else {
      alert('Your session has expired for security reasons. All progress has been lost and you must start the process over from the beginning.')
      window.location.href = '/'
    }
  }

  handleSessionWarning(timeLeft) {
    this.warningShown = true
    
    if (this.onWarningCallback) {
      this.onWarningCallback(Math.floor(timeLeft / 1000))
    } else {
      const minutes = Math.floor(timeLeft / 60000)
      const seconds = Math.floor((timeLeft % 60000) / 1000)
      console.warn(`Session will expire in ${minutes}:${seconds.toString().padStart(2, '0')} - ALL PROGRESS WILL BE LOST`)
    }
  }

  refreshSession() {
    this.warningShown = false
    
    if (typeof sessionStorage !== 'undefined') {
      const sessionInfo = sessionStorage.getItem(SESSION_CONFIG.STORAGE_KEY)
      if (sessionInfo) {
        try {
          const parsed = JSON.parse(sessionInfo)
          parsed.lastUpdate = Date.now()
          sessionStorage.setItem(SESSION_CONFIG.STORAGE_KEY, JSON.stringify(parsed))
        } catch (error) {
          console.error('Failed to update session info:', error)
        }
      }
    }
  }

  setupActivityListeners() {
    // Only run in browser (document is not available during SSR)
    if (typeof document === 'undefined') return
    
    const resetWarning = () => {
      this.warningShown = false
      this.refreshAdminSession() // Also refresh admin session on activity
    }

    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
      document.addEventListener(event, resetWarning, { passive: true })
    })
  }

  setTimeoutCallback(callback) {
    this.onTimeoutCallback = callback
  }

  setWarningCallback(callback) {
    this.onWarningCallback = callback
  }

  destroy() {
    this.stopMonitoring()
    
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_CONFIG.STORAGE_KEY)
    }
  }
}

export default SessionManager

// Create and export a singleton instance (only in browser)
// During SSR, this will be a dummy object that does nothing
export const sessionManager = typeof window !== 'undefined' 
  ? new SessionManager() 
  : {
      startAdminSession: () => {},
      checkAdminSession: () => {},
      refreshAdminSession: () => {},
      refreshSession: () => {},
      hasValidAdminSession: () => false,
      getAdminSessionToken: () => null,
      getCacheConfig: () => ({ keys: CACHE_KEYS, duration: CACHE_DURATION_MS }),
      clearAllAdminCache: () => {},
      generateCacheKey: () => null,
      stopMonitoring: () => {},
      setTimeoutCallback: () => {},
      setWarningCallback: () => {},
      destroy: () => {}
    }
