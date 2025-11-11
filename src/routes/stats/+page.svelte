<script>
  import { getStats, logAdminAction } from '../../lib/useApi';
  import { page } from '$app/stores';
  import IconSpinner from '../../lib/components/Icons/IconSpinner.svelte';
  import AdminTabs from '$lib/components/AdminTabs.svelte';
  import { goto } from '$app/navigation';
  import InfoBox from '../../lib/components/InfoBox.svelte';
  import { t } from 'svelte-i18n';
  import { sessionManager } from '../../lib/sessionManager';
  import { useAdminAuth } from '../../lib/useAdminAuth';
  import { onMount } from 'svelte';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.stats.title')) {
    document.title = `${$t('page.stats.title')} | Brukerkonto`;
  }

  const { loading, error: authError, executeAdminCall } = useAdminAuth();
  
  // Display limits
  const TABLE_DISPLAY_LIMIT = 50;
  
  let userStatsResponse;
  let userStatsResponseFull;
  let userTypeFilter = null;
  let accountFlowFilter = null;
  let idPortenFilter = null;
  let filteredUsers = [];
  let displayedUsers = [];

  // Generate pie chart data
  function generateChartData(users, key) {
    const counts = {};
    users.forEach(user => {
      let value;
      if (key === 'company') {
        value = user.companyName || $t('stats.unknownValue');
      } else if (key === 'department') {
        value = user.department || $t('stats.unknownValue');
      } else if (key === 'flowtype') {
        value = user.accountFlow === 'new_account' ? $t('stats.filterNewAccount') : 
                user.accountFlow === 'existing_account' ? $t('stats.filterExistingAccount') : $t('stats.unknownValue');
      }
      counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10
  }

  function generatePieChart(data, colors) {
    if (data.length === 0) return '';
    
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    let currentAngle = 0;
    const radius = 100;
    const centerX = 0;
    const centerY = 0;
    
    // Handle single item case - show full circle
    if (data.length === 1) {
      const [label, count] = data[0];
      return [{
        path: `M ${centerX} ${centerY} m -${radius}, 0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`,
        color: colors[0],
        label,
        count,
        percentage: '100.0'
      }];
    }
    
    const slices = data.map(([label, count], index) => {
      const percentage = (count / total) * 100;
      const sliceAngle = (count / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      
      // Convert to radians
      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      
      // Calculate path
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);
      
      const largeArcFlag = sliceAngle > 180 ? 1 : 0;
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
      
      currentAngle = endAngle;
      
      return {
        path: pathData,
        color: colors[index % colors.length],
        label,
        count,
        percentage: percentage.toFixed(1)
      };
    });
    
    return slices;
  }

  const chartColors = [
    '#0176ac', '#1F9562', '#4CB9D4', '#BE2E50', '#FF6384',
    '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
    '#C9CBCF', '#7CB342', '#D32F2F', '#1976D2', '#F57C00'
  ];

  $: companyData = generateChartData(filteredUsers, 'company');
  $: departmentData = generateChartData(filteredUsers, 'department');
  $: flowtypeData = generateChartData(filteredUsers, 'flowtype');
  $: companySlices = generatePieChart(companyData, chartColors);
  $: departmentSlices = generatePieChart(departmentData, chartColors);
  $: flowtypeSlices = generatePieChart(flowtypeData, chartColors);

  // Generate timeline data for bar chart (last 60 days)
  $: timelineData = (() => {
    if (!filteredUsers || filteredUsers.length === 0) return [];
    
    const today = new Date();
    const daysAgo60 = new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000));
    
    // Create date map for counting
    const dateMap = new Map();
    
    // Initialize all dates in range with 0
    for (let i = 0; i < 60; i++) {
      const date = new Date(daysAgo60.getTime() + (i * 24 * 60 * 60 * 1000));
      const dateKey = date.toISOString().split('T')[0];
      dateMap.set(dateKey, 0);
    }
    
    // Count users per day (using UTC date from ISO timestamp)
    filteredUsers.forEach(user => {
      if (user.onboardedTimestamp) {
        const dateKey = user.onboardedTimestamp.split('T')[0]; // Extract YYYY-MM-DD in UTC
        if (dateMap.has(dateKey)) {
          dateMap.set(dateKey, dateMap.get(dateKey) + 1);
        }
      }
    });
    
    // Convert to array and sort by date
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  const getUserStats = async (code, state, sessionToken = null) => {
    try {
      const result = await executeAdminCall(getStats, code, state, sessionToken);
      if (!result) return; // Duplicate call prevented
      
      userStatsResponse = result;
      userStatsResponseFull = result.csvUsers;
      
      if (typeof sessionStorage !== 'undefined' && result.sessionId) {
        const cacheKey = sessionManager.generateCacheKey('stats', result.sessionId);
        if (cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
          sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        }
      }
      
      // Start admin session with token from backend
      if (result.sessionId) {
        sessionManager.startAdminSession(result.sessionId, result.expiresAt);
      } else {
        sessionManager.startAdminSession();
      }
      
    } catch (error) {
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
      }
      
      // For other errors, show error message
      const errorMsg = error.response?.data?.message || error.stack || error.toString();
      userStatsResponse = { hasError: true, message: errorMsg };
      
      // Clear loading flag even on error
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('admin_auth_in_progress');
      }
    }
  };

  $: filteredUsers = userStatsResponseFull
    ? userStatsResponseFull.filter(user => {
        if (userTypeFilter !== null && user.userType !== userTypeFilter) return false;
        if (accountFlowFilter !== null && user.accountFlow !== accountFlowFilter) return false;
        if (idPortenFilter !== null && user.latestLogEntry?.idPorten?.amr?.[0] !== idPortenFilter) return false;
        return true;
      })
    : [];

  // Limit displayed users for performance
  $: displayedUsers = filteredUsers.slice(0, TABLE_DISPLAY_LIMIT);

  function setUserTypeFilter(type) {
    userTypeFilter = type;
  }
  function setAccountFlowFilter(flow) {
    accountFlowFilter = flow;
  }
  function setIdPortenFilter(val) {
    idPortenFilter = val;
  }

  // Handle component lifecycle
  onMount(async () => {
    // Restore CSV download rate limiting from sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const savedCount = sessionStorage.getItem('csv_download_count');
      const savedTime = sessionStorage.getItem('csv_last_download');
      if (savedCount) csvDownloadCount = parseInt(savedCount);
      if (savedTime) lastCsvDownload = parseInt(savedTime);
    }

    // Check if we have an existing admin session
    const hasAdminSession = sessionManager.hasValidAdminSession();
    
    const code = $page.state?.code;
    const state = $page.state?.state;
    
    if (hasAdminSession) {
      // Have valid session - check cache first
      const sessionToken = sessionManager.getAdminSessionToken();
      if (sessionToken) {
        // Try to load from cache first (session-bound cache key)
        const cacheKey = sessionManager.generateCacheKey('stats', sessionToken);
        if (cacheKey && typeof sessionStorage !== 'undefined') {
          const cachedStats = sessionStorage.getItem(cacheKey);
          const cacheTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`);
          
          if (cachedStats && cacheTimestamp) {
            const age = Date.now() - parseInt(cacheTimestamp);
            const cacheMaxAge = 5 * 60 * 1000; // 5 minutes
            
            if (age < cacheMaxAge) {
              const parsed = JSON.parse(cachedStats);
              userStatsResponse = parsed;
              userStatsResponseFull = parsed.csvUsers;
              $loading.set(false);
              
              // Still start session to refresh activity
              sessionManager.startAdminSession(sessionToken);
              return;
            }
          }
        }
        
        // No cache or expired - fetch fresh stats
        // getUserStats will handle auth errors and redirect if needed
        await getUserStats(null, null, sessionToken);
        return;
      }
      
      // Have session but no token - something is wrong
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('admin_session_info');
        sessionStorage.removeItem('admin_session_token');
        sessionStorage.removeItem('admin_session_expires');
        sessionManager.clearAllAdminCache();
      }
      goto('/admin');
      return;
    }
    
    if (code && state) {
      // First time authentication with OAuth callback
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('admin_auth_in_progress', 'true');
      }
      getUserStats(code, state);
    } else {
      // No session and no OAuth params - redirect to admin login
      goto('/admin');
    }
  });

  // 🔒 CSV DOWNLOAD SECURITY
  let showCsvConfirmation = false;
  let csvDownloadCount = 0;
  let lastCsvDownload = 0;
  const CSV_RATE_LIMIT = 5; // Max 5 downloads per session
  const CSV_COOLDOWN = 60000; // 1 minute cooldown between downloads

  function requestCsvDownload() {
    // Rate limiting check
    const now = Date.now();
    if (now - lastCsvDownload < CSV_COOLDOWN) {
      const waitSeconds = Math.ceil((CSV_COOLDOWN - (now - lastCsvDownload)) / 1000);
      alert($t('stats.csvCooldown', { default: `Please wait ${waitSeconds} seconds before downloading again.` }).replace('{seconds}', waitSeconds));
      return;
    }

    if (csvDownloadCount >= CSV_RATE_LIMIT) {
      alert($t('stats.csvRateLimitExceeded', { default: 'Download limit reached for this session. Please log in again to continue.' }));
      return;
    }

    showCsvConfirmation = true;
  }

  async function confirmCsvDownload() {
    showCsvConfirmation = false;
    
    if (!filteredUsers || filteredUsers.length === 0) return;
    
    // Audit log the download attempt
    console.log('📝 Attempting to log CSV download...');
    try {
      await logCsvDownload();
      console.log('✅ Audit log sent successfully');
    } catch (error) {
      console.error('❌ Failed to log CSV download:', error);
      // Continue with download even if audit logging fails
    }

    // Generate CSV with security watermark
    const today = new Date();
    const sessionToken = sessionManager.getAdminSessionToken();
    const downloadMetadata = [
      '# CONFIDENTIAL DATA EXPORT',
      `# Downloaded: ${today.toISOString()}`,
      `# Session: ${sessionToken ? sessionToken.substring(0, 8) + '...' : 'unknown'}`,
      `# Records: ${filteredUsers.length}`,
      `# Filters: Type=${userTypeFilter || 'all'}, Flow=${accountFlowFilter || 'all'}, IdPorten=${idPortenFilter || 'all'}`,
      '# WARNING: This file contains sensitive data. Handle according to GDPR requirements.',
      ''
    ];

    const headers = [
      $t('stats.tableDate'), $t('stats.tableAccountType'), $t('stats.tableFlow'), 
      $t('stats.tableCompany'), $t('stats.tableDepartment'), $t('stats.tableStatus'), $t('stats.tableIdPorten')
    ];
    
    const rows = filteredUsers.map(user => [
      user.onboardedTimestamp ? new Date(user.onboardedTimestamp).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '-',
      user.userType || '-',
      user.accountFlow === 'new_account' ? $t('stats.flowNew') : user.accountFlow === 'existing_account' ? $t('stats.flowExisting') : '-',
      user.companyName || '-',
      user.department || '-',
      user.latestLogEntry?.status || '-',
      user.latestLogEntry?.idPorten?.amr?.[0] || '-'
    ]);
    
    const csvContent = [
      ...downloadMetadata,
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const date = `${day}-${month}-${year}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${date}-statistikk-CONFIDENTIAL.csv`;
    link.click();
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    // Update rate limiting
    csvDownloadCount++;
    lastCsvDownload = Date.now();
    
    // Store in sessionStorage for persistence
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('csv_download_count', csvDownloadCount.toString());
      sessionStorage.setItem('csv_last_download', lastCsvDownload.toString());
    }
  }

  async function logCsvDownload() {
    // Send audit log to backend directly (no proxy needed)
    console.log('🔍 logCsvDownload called');
    try {
      const sessionToken = sessionManager.getAdminSessionToken();
      console.log('🔑 Session token:', sessionToken ? 'exists' : 'missing');
      
      const metadata = {
        recordCount: filteredUsers.length,
        filters: {
          userType: userTypeFilter,
          accountFlow: accountFlowFilter,
          idPorten: idPortenFilter
        }
      };
      console.log('📤 Sending audit log to Function App:', metadata);
      
      await logAdminAction(sessionToken, 'CSV_DOWNLOAD', metadata);
      
      console.log('✅ Audit log successful');
    } catch (error) {
      console.error('❌ Failed to send audit log:', error);
    }
  }

  function cancelCsvDownload() {
    showCsvConfirmation = false;
  }
</script>

<!-- 🔒 CSV Download Confirmation Modal -->
{#if showCsvConfirmation}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={cancelCsvDownload} role="presentation">
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="modal-content" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && cancelCsvDownload()} role="dialog" aria-modal="true" aria-labelledby="csv-confirm-title">
      <div class="modal-header">
        <span class="material-symbols-outlined" style="color: #FF9800; font-size: 48px;">warning</span>
        <h2 id="csv-confirm-title">{$t('stats.csvConfirmTitle', { default: 'Bekreft nedlasting av sensitiv data' })}</h2>
      </div>
      <div class="modal-body">
        <p><strong>{$t('stats.csvConfirmWarning', { default: 'Du er i ferd med å laste ned en fil med persondata.' })}</strong></p>
        <ul style="text-align: left; margin: 15px 0;">
          <li>{$t('stats.csvConfirmPoint1', { default: 'Filen inneholder statistikkdata som kan identifisere brukere' })}</li>
          <li>{$t('stats.csvConfirmPoint2', { default: 'Nedlastingen vil bli logget i systemet' })}</li>
          <li>{$t('stats.csvConfirmPoint3', { default: 'Du er ansvarlig for å håndtere data i henhold til GDPR' })}</li>
          <li>{$t('stats.csvConfirmPoint4', { default: 'Filen skal ikke deles med uautoriserte personer' })}</li>
        </ul>
        <p><strong>{filteredUsers.length}</strong> {$t('stats.csvConfirmRecords', { default: 'poster vil bli eksportert' })}</p>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" on:click={cancelCsvDownload}>
          <span class="material-symbols-outlined">close</span>
          {$t('stats.csvConfirmCancel', { default: 'Avbryt' })}
        </button>
        <button class="btn-primary" on:click={confirmCsvDownload}>
          <span class="material-symbols-outlined">download</span>
          {$t('stats.csvConfirmDownload', { default: 'Last ned' })}
        </button>
      </div>
    </div>
  </div>
{/if}

<div class="page-container">
  <AdminTabs active="stats" />

  {#if !userStatsResponse}
    <div class="loading">
      <IconSpinner />
      <p>{$t('stats.loading')}...</p>
    </div>
  {:else if userStatsResponse.hasError}
    <div class="centerstuff error-section">
      <div class="error">
        <h3 class="errorTitle">{$t('stats.error')}</h3>
        <p>{userStatsResponse.message}</p>
        <button class="back-btn" on:click={() => goto('/')}>{$t('common.backToAdmin')}</button>
      </div>
    </div>
  {:else}
    <main>
      {#if !userStatsResponseFull || userStatsResponseFull.length === 0}
        <div class="centerstuff empty-state">
          <div class="empty-message">
            <span class="material-symbols-outlined" style="font-size: 64px; color: #999;">analytics</span>
            <h3>{$t('stats.noData')}</h3>
            <p>{$t('stats.noDataMessage')}</p>
          </div>
        </div>
      {:else}
      <div class="centerstuff">
        <button on:click={() => requestCsvDownload()}><span class="material-symbols-outlined">download</span>{$t('stats.downloadCsv')}</button>
      </div>

      <!-- Timeline Bar Chart -->
      {#if timelineData.length > 0}
        {@const maxCount = Math.max(...timelineData.map(d => d.count), 1)}
        {@const yAxisMax = Math.max(maxCount, 4)}
        <div class="timeline-chart-container">
          <h3>{$t('stats.chartTimeline')}</h3>
          <div class="timeline-chart">
            <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet">
              <!-- Y-axis labels -->
              {#each Array(5) as _, i}
                {@const value = Math.round((yAxisMax / 4) * (4 - i))}
                {@const y = 40 + (i * 50)}
                <text x="35" y={y + 5} font-size="10" fill="#666" text-anchor="end">{value}</text>
                <line x1="40" y1={y} x2="980" y2={y} stroke="#e0e0e0" stroke-width="0.5" />
              {/each}
              
              <!-- Bars -->
              {#each timelineData as dataPoint, index}
                {@const x = 50 + (index * (920 / timelineData.length))}
                {@const barHeight = (dataPoint.count / yAxisMax) * 200}
                {@const y = 240 - barHeight}
                
                <rect 
                  x={x} 
                  y={y} 
                  width={Math.max(920 / timelineData.length - 2, 1)} 
                  height={barHeight}
                  fill="#0176ac"
                  opacity="0.8"
                >
                  <title>{dataPoint.date}: {dataPoint.count} users</title>
                </rect>
              {/each}
              
              <!-- X-axis -->
              <line x1="40" y1="240" x2="980" y2="240" stroke="#333" stroke-width="1" />
              
              <!-- X-axis date labels (show every 10th day to avoid crowding) -->
              {#each timelineData.filter((_, i) => i % 10 === 0 || i === timelineData.length - 1) as dataPoint}
                {@const actualIndex = timelineData.indexOf(dataPoint)}
                {@const x = 50 + (actualIndex * (920 / timelineData.length))}
                {@const dateLabel = new Date(dataPoint.date).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                
                <text 
                  x={x} 
                  y="260" 
                  font-size="9" 
                  fill="#666" 
                  text-anchor="middle"
                  transform="rotate(-45, {x}, 260)"
                >
                  {dateLabel}
                </text>
              {/each}
            </svg>
          </div>
        </div>
      {/if}

      <!-- Pie Charts Section -->
      <div class="charts-container">
        <div class="chart-wrapper">
          <h3>{$t('stats.chartAccountType')} ({filteredUsers.length})</h3>
          <div class="chart-content">
            <div class="chart-legend">
              {#each flowtypeSlices as slice}
                <div class="legend-item">
                  <span class="legend-color" style="background-color: {slice.color};"></span>
                  <span class="legend-label">{slice.label} ({slice.count})</span>
                </div>
              {/each}
            </div>
            <div class="chart-svg-container">
              <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(120, 120)">
                  {#each flowtypeSlices as slice, i}
                    <path d={slice.path} fill={slice.color} stroke="#fff" stroke-width="2">
                      <title>{slice.label}: {slice.count} ({slice.percentage}%)</title>
                    </path>
                  {/each}
                </g>
              </svg>
            </div>
          </div>
        </div>
        <div class="chart-wrapper">
          <h3>{$t('stats.chartDepartment')}</h3>
          <div class="chart-content">
            <div class="chart-legend">
              {#each departmentSlices as slice}
                <div class="legend-item">
                  <span class="legend-color" style="background-color: {slice.color};"></span>
                  <span class="legend-label">{slice.label} ({slice.count})</span>
                </div>
              {/each}
            </div>
            <div class="chart-svg-container">
              <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(120, 120)">
                  {#each departmentSlices as slice, i}
                    <path d={slice.path} fill={slice.color} stroke="#fff" stroke-width="2">
                      <title>{slice.label}: {slice.count} ({slice.percentage}%)</title>
                    </path>
                  {/each}
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="centerstuff">
        <button on:click={() => setUserTypeFilter(null)} class:userTypeActive={userTypeFilter===null}>{$t('stats.filterAll')}</button>
        <button on:click={() => setUserTypeFilter('elev')} class:userTypeActive={userTypeFilter==='elev'}>{$t('stats.filterStudent')}</button>
        <button on:click={() => setUserTypeFilter('ansatt')} class:userTypeActive={userTypeFilter==='ansatt'}>{$t('stats.filterEmployee')}</button>
        <button on:click={() => setAccountFlowFilter(null)} class:accountFlowActive={accountFlowFilter===null}>{$t('stats.filterAllFlows')}</button>
        <button on:click={() => setAccountFlowFilter('new_account')} class:accountFlowActive={accountFlowFilter==='new_account'}>{$t('stats.filterNewAccount')}</button>
        <button on:click={() => setAccountFlowFilter('existing_account')} class:accountFlowActive={accountFlowFilter==='existing_account'}>{$t('stats.filterExistingAccount')}</button>
      </div>
      <div class="centerstuff">
        <table>
          <thead>
            <tr>
              <th colspan="8" style="text-align:left; font-weight:normal; background:#f5f5f5;">
                {$t('stats.showingResults', { displayed: displayedUsers.length, total: filteredUsers.length })}
                {#if filteredUsers.length > TABLE_DISPLAY_LIMIT}
                  {$t('stats.limitedDisplay', { limit: TABLE_DISPLAY_LIMIT })}
                {/if}
              </th>
            </tr>
            <tr>
              <th>{$t('stats.tableDate')}</th>
              <th class="hide-mobile">{$t('stats.tableAccountType')}</th>
              <th>{$t('stats.tableFlow')}</th>
              <th class="hide-mobile">{$t('stats.tableCompany')}</th>
              <th>{$t('stats.tableDepartment')}</th>
              <th>{$t('stats.tableStatus')}</th>
              <th class="hide-mobile">{$t('stats.tableIdPorten')}</th>
            </tr>
          </thead>
          <tbody>
            {#each [...displayedUsers].sort((a, b) => {
              const companyA = (a.companyName || '').toLowerCase();
              const companyB = (b.companyName || '').toLowerCase();
              if (companyA < companyB) return -1;
              if (companyA > companyB) return 1;
              const deptA = (a.department || '').toLowerCase();
              const deptB = (b.department || '').toLowerCase();
              if (deptA < deptB) return -1;
              if (deptA > deptB) return 1;
              return 0;
            }) as user}
              <tr>
                <td>{user.onboardedTimestamp ? new Date(user.onboardedTimestamp).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '-'}</td>
                <td class="hide-mobile">{user.userType}</td>
                <td>{user.accountFlow === 'new_account' ? $t('stats.flowNew') : user.accountFlow === 'existing_account' ? $t('stats.flowExisting') : '-'}</td>
                <td class="hide-mobile">{user.companyName || '-'}</td>
                <td>{user.department || '-'}</td>
                <td>{user.latestLogEntry?.status || '-'}</td>
                <td class="hide-mobile">{user.latestLogEntry?.idPorten?.amr?.[0] || '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {/if}
    </main>
  {/if}
</div>

<style>
  .page-container {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  /* 🔒 CSV Confirmation Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    padding: 32px;
    max-width: 550px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 22px;
    color: #333;
    text-align: center;
  }

  .modal-body {
    margin: 20px 0;
    color: #555;
    line-height: 1.6;
  }

  .modal-body ul {
    padding-left: 20px;
  }

  .modal-body li {
    margin: 8px 0;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
  }

  .modal-actions button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: #e0e0e0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #d0d0d0;
  }

  .btn-primary {
    background: #0176ac;
    color: white;
  }

  .btn-primary:hover {
    background: #015a8a;
  }

  .modal-actions .material-symbols-outlined {
    font-size: 18px;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    justify-content: center;
    margin-top: 20px;
  }
  .centerstuff {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      margin: 20px auto;
      padding: 0 20px;
      max-width: 1200px;
      width: 100%;
  }
  
  .centerstuff table {
    overflow-x: auto;
  }
  .error {
    background-color: var(--nype-10);
    padding: 16px;
  }

  main {
    display: block;
    margin-top: 20px;
  }

  .empty-state {
    flex-direction: column;
    padding: 60px 20px;
  }

  .empty-message {
    text-align: center;
    max-width: 500px;
    margin: 0 auto;
  }

  .empty-message h3 {
    color: #333;
    margin: 20px 0 12px 0;
    font-size: 24px;
  }

  .empty-message p {
    color: #666;
    line-height: 1.6;
    margin: 8px 0;
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

  th {
    background: #f5f5f5;
    font-weight: 600;
    position: sticky;
    top: 0;
  }

  tr:hover {
    background: #f9f9f9;
  }

  button {
    margin: 10px;
  }

  .centerstuff button {
    color: #fff !important;
    background: var(--primary-color, #0176ac);
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .centerstuff button .material-symbols-outlined {
    color: #fff !important;
  }

  .userTypeActive {
    background: #1F9562 !important;
  }

  .charts-container {
    display: flex;
    gap: 40px;
    margin: 20px auto;
    max-width: 1240px;
    padding: 0 20px;
    flex-wrap: nowrap;
    justify-content: center;
  }

  .chart-wrapper {
    flex: 1 1 0;
    width: 0;
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .chart-wrapper h3 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
  }

  .chart-content {
    display: flex;
    flex-direction: row;
    gap: 30px;
    align-items: flex-start;
    justify-content: center;
  }

  .chart-legend {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
    flex: 0 0 auto;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #333;
  }

  .legend-color {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-label {
    white-space: nowrap;
  }

  .chart-svg-container {
    position: relative;
    width: 100%;
    max-width: 240px;
    margin: 0 auto;
  }

  .chart-svg-container svg {
    width: 100%;
    height: auto;
  }

  /* Timeline Bar Chart Styles */
  .timeline-chart-container {
    width: 100%;
    max-width: 1200px;
    margin: 20px auto;
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .timeline-chart-container h3 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
  }

  .timeline-chart {
    width: 100%;
    overflow-x: auto;
  }

  .timeline-chart svg {
    width: 100%;
    min-width: 600px;
    height: auto;
  }

  .timeline-chart rect {
    transition: opacity 0.2s;
  }

  .timeline-chart rect:hover {
    opacity: 1 !important;
    cursor: pointer;
  }

  .accountFlowActive {
    background: #7C3AED !important;
  }

  /* Mobile responsive - hide certain columns on small screens */
  @media (max-width: 768px) {
    .hide-mobile {
      display: none;
    }
    
    table {
      font-size: 14px;
    }
    
    th, td {
      padding: 8px 4px;
    }
    
    .chart-wrapper {
      min-width: 100%;
      padding: 16px;
    }

    .chart-content {
      flex-direction: column;
      align-items: center;
    }

    .chart-legend {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }

    .timeline-chart-container {
      padding: 16px;
      margin: 20px auto;
    }

    .timeline-chart-container h3 {
      font-size: 16px;
    }
    
    .centerstuff button {
      font-size: 0.9rem;
      padding: 0.4rem 1rem;
    }
  }

  @media (max-width: 1200px) {
    .charts-container {
      flex-direction: column;
      align-items: center;
      margin: 20px auto;
    }
    
    .chart-wrapper {
      max-width: 100%;
      width: 100%;
    }
  }
</style>
