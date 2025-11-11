/**
 * API Client Module
 * Handles all communication with the Onboarding API backend
 */

let globalSessionManager = null

// Admin API endpoints that don't auto-redirect on 401
const ADMIN_ENDPOINTS = ['/GetDebugLogs', '/GetStatsData']

/**
 * Set the global session manager for handling session timeouts
 * @param {object} sessionManager - Session manager instance
 */
export const setGlobalSessionManager = (sessionManager) => {
  globalSessionManager = sessionManager
}

/**
 * Build standard headers for API requests
 * @returns {object} Headers object with API key and content type
 */
const buildHeaders = () => ({
  'x-functions-key': import.meta.env.VITE_ONBOARDING_API_PUBLIC_KEY,
  'Content-Type': 'application/json'
})

/**
 * Make HTTP request to API
 * @param {string} url - Full API URL
 * @param {object} options - Request options
 * @param {string} options.method - HTTP method (default: GET)
 * @param {object} options.body - Request body
 * @param {object} options.headers - Additional headers
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} HTTP error with status and correlationId
 */
const request = async (url, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(url, {
    method,
    headers: { ...buildHeaders(), ...headers },
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401 && globalSessionManager) {
    // Check if this is an admin endpoint
    const isAdminEndpoint = ADMIN_ENDPOINTS.some(endpoint => url.includes(endpoint))
    
    if (isAdminEndpoint) {
      console.warn('Admin endpoint returned 401 - OAuth code/state invalid or expired')
      // Don't auto-redirect - let the page handle the error
      // The 401 will be caught as an error and can show a proper message
      // instead of forcing redirect which loses context
    } else {
      console.warn('User session expired (401) - redirecting to login')
      globalSessionManager.handleSessionTimeout()
    }
  }

  if (!res.ok) {
    let payload = null
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      payload = await res.json().catch(() => null)
    } else {
      const text = await res.text().catch(() => '')
      payload = text ? { message: text } : null
    }
    const err = new Error(payload?.message || res.statusText || `HTTP ${res.status}`)
    err.status = res.status
    // Try to get correlationId from body or header
    err.correlationId = payload?.correlationId || res.headers.get('x-correlation-id') || null
    err.payload = payload
    throw err
  }

  return res.json()
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Get IdPorten login URL
 * @param {string} userType - User type (ansatt, elev, etc)
 * @param {string} action - Action to perform
 * @param {string} lang - Language code (optional)
 * @returns {Promise<object>} Response with loginUrl
 */
export const getIdPortenLoginUrl = async (userType, action, lang) => {
  if (!(userType && action)) throw new Error('Missing required parameters: "userType" and "action"')
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(2000)
    return { loginUrl: `/mockidporten?user_type=${userType}&action=${action}` }
  }
  let url = `${import.meta.env.VITE_ONBOARDING_API_URI}/IdPortenLoginUrl?user_type=${userType}&action=${action}`
  if (lang) url += `&lang=${lang}`
  return request(url)
}

export const getEntraValidationLoginUrl = async (loginHint, correlationId, options = {}) => {
  if (!correlationId) throw new Error('Missing required parameters: "correlationId"')
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    return { loginUrl: `/mockentra?loginHint=demodemo&correlation_id=${correlationId}&action=mfa` }
  }
  const params = new URLSearchParams({
    login_hint: loginHint,
    correlation_id: correlationId
  })
  
  // Add flow_type if provided (for hybrid password flow)
  if (options.flowType) {
    params.append('flow_type', options.flowType)
  }
  
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/EntraValidationLoginUrl?${params.toString()}`)
}

export const getResetMfaLoginUrl = async (loginHint, correlationId) => {
  if (!correlationId) throw new Error('Missing required parameters: "correlationId"')
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    return { loginUrl: `/mockentra?action=resetmfa&correlation_id=${correlationId}` }
  }
  const params = []
  if (loginHint) params.push(`login_hint=${encodeURIComponent(loginHint)}`)
  params.push(`correlation_id=${encodeURIComponent(correlationId)}`)
  const base = `${import.meta.env.VITE_ONBOARDING_API_URI}/ResetMfaLoginUrl`
  const url = `${base}?${params.join('&')}`
  return request(url)
}

/**
 * Reset MFA methods for user
 * @param {string} code - Authorization code from IdPorten
 * @param {string} state - State from IdPorten callback
 * @returns {Promise<object>} Response with deletion results
 */
export const resetMfaMethods = async (code, state) => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(1000)
    // Simulated response structure matching real ResetMfaMethods output
    const fakeCorrelationId = 'mockcorr' + Date.now().toString(36)
    return {
      message: 'All deletable MFA methods removed for user',
      userPrincipalName: 'mock.user@demo.local',
      removedCount: 3,
      keptCount: 0,
      deletionStrategy: 'hybrid',
      appPermissionResults: 2,
      userPermissionResults: 1,
      methodBreakdown: [],
      validationLoginUrl: `/mockentra?action=mfa&correlation_id=${fakeCorrelationId}`,
      correlationId: fakeCorrelationId.slice(-6),
      fullCorrelationId: fakeCorrelationId
    }
  }
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/ResetMfaMethods`, { method: 'POST', body: { code, state } })
}

/**
 * Get admin login URL for Entra ID authentication
 * @param {string} action - Admin action type (default: 'debug')
 * @returns {Promise<object>} Response with admin loginUrl
 */
export const getAdminLoginUrl = async (action = 'debug') => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    return { loginUrl: `/mockentra?action=${action}` }
  }
  const url = `${import.meta.env.VITE_ONBOARDING_API_URI}/EntraAdminLoginUrl`
  console.log('getAdminLoginUrl - Calling URL:', url, 'with action:', action)
  const result = await request(url, { method: 'POST', body: { action } })
  console.log('getAdminLoginUrl - Result:', result)
  return result
}

/**
 * Get debug logs for onboarding process
 * @param {string} code - Authorization code from IdPorten or Entra ID
 * @param {string} state - State from OAuth callback
 * @param {string} sessionToken - Admin session token (optional)
 * @returns {Promise<object>} Response with logs array and metadata
 */
export const getDebugLogs = async (code, state, sessionToken = null) => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(1000)
    return {
      logs: [
        { timestamp: '2025-10-13T10:45:32.123Z', correlationId: 'f7k9m2', level: 'warn', helpdesk_message: 'The phone number lookup is taking too long. Please try again, or manually enter your phone number.' },
        { timestamp: '2025-10-13T10:44:18.456Z', correlationId: 'k3n8p1', level: 'error', helpdesk_message: 'We\'re having trouble retrieving employment records. Please try again, or contact your manager/school if this continues.' },
        { timestamp: '2025-10-13T10:42:55.789Z', correlationId: 'j5m7n4', level: 'warn', helpdesk_message: 'Your MFA validation timed out. Please try again.' },
        { timestamp: '2025-10-13T10:41:20.234Z', correlationId: 'm8k2q6', level: 'error', helpdesk_message: 'We couldn\'t send the SMS code. Check if your phone number is correct and try again, or contact support.' },
        { timestamp: '2025-10-13T10:39:47.567Z', correlationId: 'p4r9t3', level: 'error', helpdesk_message: 'We\'re having trouble retrieving employment records. Please try again, or contact your manager/school if this continues.' },
        { timestamp: '2025-10-13T10:38:12.890Z', correlationId: 'q7s5v8', level: 'warn', helpdesk_message: 'Your session has expired. Please start the process again from the beginning.' },
        { timestamp: '2025-10-13T10:36:33.456Z', correlationId: 'w2x6y9', level: 'warn', helpdesk_message: 'Your session has expired. Please start the process again from the beginning.' },
        { timestamp: '2025-10-13T10:34:58.123Z', correlationId: 'z1b4c7', level: 'error', helpdesk_message: 'We can\'t find your account. Please verify your information and try again, or contact support.' },
        { timestamp: '2025-10-13T10:33:21.789Z', correlationId: 'd3f8g2', level: 'error', helpdesk_message: 'Too many requests to the system. Please wait a moment and try again.' },
        { timestamp: '2025-10-13T10:31:45.456Z', correlationId: 'h5j9k4', level: 'warn', helpdesk_message: 'We\'re having database issues. Please try again, or contact support if the problem persists.' }
      ],
      count: 10,
      sessionId: 'mock-session-123',
      expiresAt: Date.now() + 30 * 60 * 1000
    }
  }
  
  // Build request body with either OAuth params or session token
  const body = sessionToken 
    ? { sessionId: sessionToken }
    : { code, state };
  
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/GetDebugLogs`, { 
    method: 'POST', 
    body 
  })
}

export const getIdportenLogoutUrl = async () => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    return { logoutUrl: '/' }
  }
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/IdPortenLogoutUrl`)
}

export const verifyUser = async (code, iss, state) => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(1000)
    return {
      correlationId: 'jijijijiji',
      displayName: 'Kari Nordmann',
      userPrincipalName: 'mock.kari.nordmann@fylke.no'
    }
  }
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/VerifyUser`, { method: 'POST', body: { code, iss, state } })
}

export const entraMfaAuth = async (code, state) => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(1000)
    return {
      correlationId: 'jfiji',
      displayName: 'Kari Nordmann',
      userPrincipalName: 'mock.kari.nordmann@fylke.no',
    }
  }
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/EntraValidationAuth`, { method: 'POST', body: { code, state } })
}

/**
 * Get statistics and user data for admin dashboard
 * @param {string} code - Authorization code from Entra ID
 * @param {string} state - State from OAuth callback
 * @param {string} sessionToken - Admin session token (optional)
 * @returns {Promise<object>} Response with user statistics and CSV data
 */
export const getStats = async (code, state, sessionToken = null) => {
  if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(1000)
    return {
      csvUsers: [
        {
          "_id": "67123abc5220d6e8f20d8001",
          "userType": "ansatt",
          "accountFlow": "new_account",
          "department": "Færder vgs matematikk",
          "companyName": "Færder videregående skole",
          "onboardedTimestamp": "2025-10-13T10:45:32.123Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["BankID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8002",
          "userType": "ansatt",
          "accountFlow": "existing_account",
          "department": "Re vgs elevtjeneste",
          "companyName": "Re videregående skole",
          "onboardedTimestamp": "2025-10-12T14:20:18.456Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["MinID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8003",
          "userType": "elev",
          "accountFlow": "new_account",
          "department": "Thor Heyerdahl vgs studieforberedende",
          "companyName": "Thor Heyerdahl videregående skole",
          "onboardedTimestamp": "2025-10-10T09:15:55.789Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["BankID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8004",
          "userType": "ansatt",
          "accountFlow": "new_account",
          "department": "Nøtterøy vgs norsk",
          "companyName": "Nøtterøy videregående skole",
          "onboardedTimestamp": "2025-10-08T11:30:20.234Z",
          "latestLogEntry": {
            "status": "in_progress",
            "idPorten": { "amr": ["Commfides"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8005",
          "userType": "ansatt",
          "accountFlow": "existing_account",
          "department": "Opplæring og tannhelse IT-støtte",
          "companyName": "Opplæring og tannhelse",
          "onboardedTimestamp": "2025-10-05T13:45:12.890Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["BankID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8006",
          "userType": "elev",
          "accountFlow": "existing_account",
          "department": "Færder vgs design og håndverk",
          "companyName": "Færder videregående skole",
          "onboardedTimestamp": "2025-10-03T10:20:33.456Z",
          "latestLogEntry": {
            "status": "pending",
            "idPorten": { "amr": ["MinID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8007",
          "userType": "ansatt",
          "accountFlow": "new_account",
          "department": "Horten tannklinikk",
          "companyName": "Seksjon tannhelse",
          "onboardedTimestamp": "2025-09-28T15:10:58.123Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["BankID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8008",
          "userType": "ansatt",
          "accountFlow": "new_account",
          "department": "Seksjon mobilitet rådgivning",
          "companyName": "Seksjon mobilitet",
          "onboardedTimestamp": "2025-09-25T12:30:21.789Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["Commfides"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8009",
          "userType": "elev",
          "accountFlow": "new_account",
          "department": "Re vgs idrettsfag",
          "companyName": "Re videregående skole",
          "onboardedTimestamp": "2025-09-20T09:45:45.456Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["BankID"] }
          }
        },
        {
          "_id": "67123abc5220d6e8f20d8010",
          "userType": "ansatt",
          "accountFlow": "existing_account",
          "department": "Kompetansebyggeren ledelse",
          "companyName": "Kompetansebyggeren",
          "onboardedTimestamp": "2025-09-15T11:20:12.345Z",
          "latestLogEntry": {
            "status": "completed",
            "idPorten": { "amr": ["MinID"] }
          }
        }
      ]
    }
  }
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/GetStatsData`, { 
    method: 'POST', 
    body: { code, state, sessionId: sessionToken } 
  })
}

/**
 * Confirm phone number and send SMS verification code
 * @param {string} confirmationState - State from previous API call
 * @param {object} opts - Additional options
 * @param {string} opts.newPhoneNumber - New phone number to verify
 * @param {string} opts.verificationToken - Token for verification
 * @param {string} opts.language - Language for SMS (optional)
 * @returns {Promise<object>} Response with validation login URL
 */
export const confirmPhoneAndSendSms = async (confirmationState, opts = {}) => {
  if (!confirmationState) throw new Error('Missing parameter "confirmationState"')
  if (import.meta.env.VITE_MOCK_API === 'true') {
    await sleep(800)
    return { success: true, validationLoginUrl: '/mockentra?loginHint=demodemo&action=mfa', updatedPhoneNumber: '+47 *****123' }
  }
  const body = { confirmationState, phoneConfirmed: true }
  if (opts?.newPhoneNumber && opts?.verificationToken) {
    body.newPhoneNumber = opts.newPhoneNumber
    body.verificationToken = opts.verificationToken
  }
  if (opts?.language) {
    body.language = opts.language
  }
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/CloudFlow`, { method: 'POST', body })
}

/**
 * Log admin action for audit trail
 * @param {string} sessionId - Admin session ID
 * @param {string} action - Action type (e.g., 'CSV_DOWNLOAD')
 * @param {object} metadata - Additional context data
 */
export const logAdminAction = async (sessionId, action, metadata = {}) => {
  if (!sessionId || !action) {
    throw new Error('Missing required parameters: sessionId, action')
  }
  
  const body = {
    sessionId,
    action,
    metadata,
    timestamp: new Date().toISOString()
  }
  
  return request(`${import.meta.env.VITE_ONBOARDING_API_URI}/AuditLog`, { method: 'POST', body })
}
