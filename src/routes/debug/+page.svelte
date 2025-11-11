<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import IconSpinner from '$lib/components/Icons/IconSpinner.svelte';
  import AdminTabs from '$lib/components/AdminTabs.svelte';
  import { getDebugLogs } from '../../lib/useApi';
  import { sessionManager } from '../../lib/sessionManager';
  import { useAdminAuth } from '../../lib/useAdminAuth';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.debug.title')) {
    document.title = `${$t('page.debug.title')} | Brukerkonto`;
  }

  const { loading, error: authError, executeAdminCall } = useAdminAuth();
  
  let errorMessage = null;
  let logs = [];
  let searchTerm = '';
  let filteredLogs = [];

  // Format timestamp to Oslo time (CET/CEST)
  const formatOsloTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    // Format as Oslo time (Europe/Oslo timezone handles CET/CEST automatically)
    return date.toLocaleString('nb-NO', { 
      timeZone: 'Europe/Oslo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Clean message by removing [corr:...] prefix
  const cleanMessage = (message) => {
    if (!message) return '-';
    // Convert to string first to handle non-string values
    const messageStr = String(message);
    return messageStr.replace(/^\[corr:[^\]]+\]\s*/, '');
  };

  // Update filtered logs whenever logs or searchTerm changes
  $: {
    // Backend already filters for warnings/errors and limits to 200
    // Just apply search filter if search term exists
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredLogs = logs.filter(log => {
        // Safely convert fields to strings and check if they include the search term
        const correlationId = String(log.correlationId || '').toLowerCase();
        const helpdesk_message = String(log.helpdesk_message || log.message || '').toLowerCase();
        
        return correlationId.includes(searchLower) ||
               helpdesk_message.includes(searchLower);
      });
    } else {
      filteredLogs = logs;
    }
  }

  const fetchLogs = async (code, state, sessionToken = null) => {
    try {
      // Use provided session token or get from sessionManager
      if (!sessionToken) {
        sessionToken = sessionManager.getAdminSessionToken();
      }
      
      // Call API with either OAuth code/state OR session token
      const response = await executeAdminCall(getDebugLogs, code, state, sessionToken);
      if (!response) return; // Duplicate call prevented
      
      // Sort logs by timestamp descending (latest first)
      logs = (response.logs || []).sort((a, b) => {
        const dateA = new Date(a.timestamp || 0);
        const dateB = new Date(b.timestamp || 0);
        return dateB - dateA; // Descending order
      });
      
      // Initialize filteredLogs with sorted logs (triggers reactive statement)
      if (!searchTerm) {
        filteredLogs = logs;
      }
      
      // ✅ SECURITY: Cache logs with session-bound key (cache invalidated on session change)
      if (typeof sessionStorage !== 'undefined' && response.sessionId) {
        const cacheKey = sessionManager.generateCacheKey('logs', response.sessionId);
        if (cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify(logs));
          sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        }
      }
      
      // THEN start admin session with token from backend
      if (response.sessionId) {
        sessionManager.startAdminSession(response.sessionId, response.expiresAt);
      } else {
        sessionManager.startAdminSession();
      }
      
    } catch (error) {
      // Error handling - adminAuth already set loading to false
      
      // Check if this is a 401/403 authentication error
      if (error.status === 401 || error.status === 403) {
        // Clear ALL session data
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('admin_session_info');
          sessionStorage.removeItem('admin_session_token');
          sessionStorage.removeItem('admin_session_expires');
          sessionStorage.removeItem('admin_auth_in_progress');
          sessionManager.clearAllAdminCache();
        }
        // Redirect immediately instead of showing error
        goto('/admin');
        return;
      } else if (error.status === 500 && error.message?.includes('Session expired')) {
        // Clear ALL session data
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('admin_session_info');
          sessionStorage.removeItem('admin_session_token');
          sessionStorage.removeItem('admin_session_expires');
          sessionStorage.removeItem('admin_auth_in_progress');
          sessionManager.clearAllAdminCache();
        }
        // Redirect immediately instead of showing error
        goto('/admin');
        return;
      } else {
        errorMessage = error.message || error.toString();
      }
      
      // Clear loading flag even on error
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('admin_auth_in_progress');
      }
    }
  };

  onMount(async () => {
    // Check if we have an existing admin session
    const hasAdminSession = sessionManager.hasValidAdminSession();
    
    const code = $page.state?.code;
    const state = $page.state?.state;
    
    if (hasAdminSession) {
      // Have valid session - check cache first
      const sessionToken = sessionManager.getAdminSessionToken();
      if (sessionToken) {
        // Try to load from cache first (session-bound cache key)
        const cacheKey = sessionManager.generateCacheKey('logs', sessionToken);
        if (cacheKey && typeof sessionStorage !== 'undefined') {
          const cachedLogs = sessionStorage.getItem(cacheKey);
          const cacheTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`);
          
          if (cachedLogs && cacheTimestamp) {
            const age = Date.now() - parseInt(cacheTimestamp);
            const cacheMaxAge = 5 * 60 * 1000; // 5 minutes
            
            if (age < cacheMaxAge) {
              logs = JSON.parse(cachedLogs);
              filteredLogs = logs;
              $loading.set(false);
              
              // Still start session to refresh activity
              sessionManager.startAdminSession(sessionToken);
              return;
            }
          }
        }
        
        // No cache or expired - fetch fresh logs
        // fetchLogs will handle auth errors and redirect if needed
        await fetchLogs(null, null, sessionToken);
        return;
      } else {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('admin_session_info');
          sessionStorage.removeItem('admin_session_token');
          sessionStorage.removeItem('admin_session_expires');
          sessionManager.clearAllAdminCache();
        }
        goto('/admin');
        return;
      }
    }
    
    if (code && state) {
      // First time authentication with OAuth callback
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('admin_auth_in_progress', 'true');
      }
      fetchLogs(code, state);
    } else {
      // No session and no OAuth params - redirect to admin login
      goto('/admin');
    }
  });
</script>

<div class="page-container">
  <AdminTabs active="debug" />

  {#if $loading}
  <div class="loading">
    <IconSpinner />
    <p>{$t('debug.loading')}...</p>
  </div>
{:else if errorMessage}
  <div class="centerstuff error-section">
    <div class="error">
      <h3 class="errorTitle">{$t('debug.error')}</h3>
      <p>{errorMessage}</p>
      <button class="back-btn" on:click={() => goto('/admin')}>{$t('debug.tryAgain')}</button>
    </div>
  </div>
{:else}
  <main>
    <div class="search-bar">
      <input 
        type="text" 
        bind:value={searchTerm} 
        placeholder={$t('debug.searchPlaceholder')}
      />
      <span class="result-count">{filteredLogs.length} / {logs.length} {$t('debug.logs')} (warnings/errors, max 200)</span>
    </div>

    <div class="logs-container">
      <table>
        <thead>
          <tr>
            <th>{$t('debug.timestamp')}</th>
            <th>{$t('debug.correlationId')}</th>
            <th>{$t('debug.level')}</th>
            <th>Helpdesk Message</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredLogs as log}
            <tr class="log-{log.level}">
              <td class="timestamp">{formatOsloTime(log.timestamp)}</td>
              <td class="correlation-id"><code>{log.correlationId}</code></td>
              <td><span class="level-badge {log.level}">{log.level}</span></td>
              <td class="helpdesk-message">{log.helpdesk_message || log.message || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </main>
{/if}
</div>

<style>
  .page-container {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    justify-content: center;
    padding: 40px;
    margin-top: 20px;
  }

  .centerstuff {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 20px;
    padding: 0 20px;
  }

  .error {
    background-color: #ffebee;
    border: 2px solid #ef5350;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(239, 83, 80, 0.2);
  }

  .errorTitle {
    color: #c62828;
    margin: 0 0 10px 0;
  }

  .error p {
    color: #333;
    margin: 10px 0;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 10px;
    color: var(--primary-color, #0176ac);
    text-decoration: none;
  }

  main {
    display: block;
    margin-top: 20px;
  }

  .search-bar {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 20px;
    padding: 0 20px;
  }

  .search-bar input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .result-count {
    color: #666;
    font-size: 14px;
  }

  .logs-container {
    overflow-x: auto;
    padding: 0 20px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }

  th:first-child, td:first-child {
    width: 1%;
    white-space: nowrap;
  }

  th:nth-child(2), td:nth-child(2) {
    width: 1%;
    white-space: nowrap;
  }

  th:nth-child(3), td:nth-child(3) {
    width: 1%;
    white-space: nowrap;
  }

  th:nth-child(4), td:nth-child(4) {
    width: auto;
  }

  th {
    background: #f5f5f5;
    font-weight: 600;
    position: sticky;
    top: 0;
  }

  tr:hover {
    background: #f9f9f9;
  }

  code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 12px;
  }

  .level-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .level-badge.info {
    background: #e3f2fd;
    color: #1976d2;
  }

  .level-badge.warn {
    background: #fff3e0;
    color: #f57c00;
  }

  .level-badge.error {
    background: #ffebee;
    color: #c62828;
  }

  .timestamp {
    width: 15%;
    white-space: nowrap;
    font-size: 12px;
  }

  .correlation-id {
    width: 15%;
    white-space: nowrap;
  }

  .helpdesk-message {
    width: 70%;
    padding: 12px;
    font-size: 13px;
    line-height: 1.4;
  }

  tr:hover {
    background: #f9f9f9;
  }

  .log-error {
    background: #fff5f5;
  }
</style>
