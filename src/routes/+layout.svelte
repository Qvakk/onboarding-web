<script>
  import { getIdportenLogoutUrl, setGlobalSessionManager } from '$lib/useApi'
  import { goto } from '$app/navigation'
  import { t, isLoading, locale as i18nLocale } from 'svelte-i18n';
  import { locale } from '$lib/i18n';
  import { onMount, onDestroy } from 'svelte';
  import { sessionManager } from '$lib/sessionManager.js';
  import LanguageDropdown from '$lib/components/LanguageDropdown.svelte';

  export let data; // params not needed; accessible via $page store if required
  const { theme } = data;

  let i18nReady = false;
  $: i18nReady = !$isLoading;

  // Session management - using singleton
  let showSessionWarning = false;
  let sessionWarningTime = 0;

  const logout = async () => {
    const { logoutUrl } = await getIdportenLogoutUrl();
    window.location.href = logoutUrl;
  };

  const handleSessionTimeout = () => {
    alert('⚠️ SESSION EXPIRED\n\nYour session has expired for security reasons.\n\n• All progress has been lost\n• You must start completely over\n• You will be redirected to choose Elev/Ansatt\n• You must re-authenticate with ID-porten\n\nClick OK to restart the process.');
    
    // Clear any remaining state and redirect to start
    if (typeof sessionStorage !== 'undefined') {
      const savedLocale = sessionStorage.getItem('locale')
      sessionStorage.clear()
      if (savedLocale) {
        sessionStorage.setItem('locale', savedLocale)
      }
    }
    
    goto('/');
  };

  const handleSessionWarning = (timeLeft) => {
    sessionWarningTime = timeLeft;
    showSessionWarning = true;
    
    // Auto-hide warning after 15 seconds if user doesn't interact
    setTimeout(() => {
      showSessionWarning = false;
    }, 15000);
  };

  const extendSession = () => {
    if (sessionManager) {
      sessionManager.refreshSession();
      showSessionWarning = false;
    }
  };

  onMount(() => {
    // Connect session manager singleton to callbacks
    if (sessionManager) {
      sessionManager.setTimeoutCallback(handleSessionTimeout);
      sessionManager.setWarningCallback(handleSessionWarning);
      
      // Connect session manager to API layer
      setGlobalSessionManager(sessionManager);
    }
  });

  onDestroy(() => {
    // Don't destroy the singleton, just disconnect callbacks
    // The singleton persists across the app lifecycle
  });

  $: appTitle = i18nReady && $t ? $t('app.title') : '';
  const supportedLocales = ['nb', 'nn', 'en', 'se'];

  let showMenu = false;

  let hasInitializedLocale = false;

  $: if (!hasInitializedLocale) {
    // Only run this logic once on mount
    hasInitializedLocale = true;
    // Check if sessionStorage already has a locale
    const sessionLocale = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('locale');
    if (!$locale || !supportedLocales.includes($locale)) {
      if (sessionLocale && supportedLocales.includes(sessionLocale)) {
        locale.set(sessionLocale);
      } else {
        const browserLang = (typeof navigator !== 'undefined' ? navigator.language : 'nb').split('-')[0];
        if (supportedLocales.includes(browserLang)) {
          locale.set(browserLang);
        } else {
          locale.set('nb');
        }
      }
    }
  }

  const languages = [
    { code: 'nb', label: 'Bokmål' },
    { code: 'nn', label: 'Nynorsk' },
    { code: 'en', label: 'English' },
    { code: 'se', label: 'Davvisámegiella' }
  ];

  // Network status banner
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  let showBackOnline = false
  let backOnlineTimer = null

  const onOnline = () => {
    isOnline = true
    showBackOnline = true
    if (backOnlineTimer) clearTimeout(backOnlineTimer)
    backOnlineTimer = setTimeout(() => { showBackOnline = false }, 4000)
  }
  const onOffline = () => {
    isOnline = false
    showBackOnline = false
    if (backOnlineTimer) {
      clearTimeout(backOnlineTimer)
      backOnlineTimer = null
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
    }
  })

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
    if (backOnlineTimer) {
      clearTimeout(backOnlineTimer)
    }
  })
</script>

<svelte:head>
  <link rel="icon" href={theme.assets.favicon} />
  <link rel="stylesheet" href={theme.assets.css}>
</svelte:head>

<!-- Skip to main content link for accessibility -->
<a href="#main-content" class="skip-link">{i18nReady ? $t('accessibility.skipToContent') : 'Skip to main content'}</a>

{#if !isOnline}
  <div class="net-banner offline" role="alert" aria-live="assertive">
    <span class="material-symbols-outlined" aria-hidden="true">wifi_off</span>
    <span>{i18nReady ? ($t('app.offline') || 'You are offline. Some actions may fail.') : 'You are offline. Some actions may fail.'}</span>
  </div>
{:else if showBackOnline}
  <div class="net-banner online" role="status" aria-live="polite">
    <span class="material-symbols-outlined" aria-hidden="true">wifi</span>
    <span>{i18nReady ? ($t('app.back_online') || 'Back online') : 'Back online'}</span>
  </div>
{/if}

<header class="topbar">
  <div class="toptop">
    <div>
      <a href="/" aria-label={i18nReady ? $t('home.title') : 'Home'}><img class="logo" src={theme.assets.logo} alt={i18nReady ? $t('logo.alt') : 'Logo'} /></a>
    </div>
    <nav aria-label={i18nReady ? $t('accessibility.mainNavigation') : 'Main navigation'} class="topbarOptions">
      <button class="link desktop-only" on:click={() => { goto('/help') } }><span class="material-symbols-outlined">help</span>{i18nReady ? $t('help.button') : 'Help'}</button>
      <LanguageDropdown className="language-dropdown desktop-only" {languages} value={$locale} />
      <!-- Hamburger for mobile -->
      <button class="hamburger mobile-only" on:click={() => showMenu = !showMenu} aria-label="Menu" aria-expanded={showMenu}>
        <span></span><span></span><span></span>
      </button>
    </nav>
  </div>
  <!-- Mobile menu -->
  {#if showMenu}
    <nav aria-label={i18nReady ? $t('accessibility.mainNavigation') : 'Main navigation'} class="mobile-menu mobile-only">
      <button class="link" on:click={() => { goto('/help'); showMenu = false; }}><span class="material-symbols-outlined">help</span>{i18nReady ? $t('help.button') : 'Help'}</button>
      <LanguageDropdown className="language-dropdown" {languages} value={$locale} onChange={() => showMenu = false} />
    </nav>
  {/if}
</header>

<main id="main-content" tabindex="-1">
  <slot></slot>
</main>

<footer class="footer">
  <slot name="footer" />
</footer>

<!-- Session Warning Dialog -->
{#if showSessionWarning}
  <div class="session-warning-overlay" role="dialog" aria-labelledby="session-warning-title">
    <div class="session-warning-dialog">
      <h3 id="session-warning-title">⚠️ Session Expiring Soon</h3>
      <p><strong>Your session will expire in {Math.floor(sessionWarningTime / 60)}:{(sessionWarningTime % 60).toString().padStart(2, '0')} minutes.</strong></p>
      <p class="warning-text">⚠️ <strong>All progress will be lost</strong> and you will need to start over from ID-porten authentication if your session expires.</p>
      <div class="session-warning-buttons">
        <button class="button primary" on:click={extendSession}>
          Continue Session
        </button>
        <button class="button secondary" on:click={() => showSessionWarning = false}>
          Dismiss Warning
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Skip to main content link for accessibility */
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px 16px;
    text-decoration: none;
    z-index: 10001;
    border-radius: 0 0 4px 0;
    font-weight: 500;
  }

  .skip-link:focus {
    top: 0;
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .session-warning-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease-in-out;
  }

  .session-warning-dialog {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
    text-align: center;
    animation: slideIn 0.3s ease-in-out;
  }

  .session-warning-dialog h3 {
    margin: 0 0 1rem 0;
    color: #d63384;
    font-size: 1.25rem;
  }

  .session-warning-dialog p {
    margin: 0 0 1rem 0;
    color: #495057;
    line-height: 1.5;
  }

  .session-warning-dialog .warning-text {
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    padding: 0.75rem;
    margin: 1rem 0;
    color: #856404;
    font-size: 0.9rem;
  }

  .session-warning-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .session-warning-buttons .button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    min-width: 120px;
  }

  .session-warning-buttons .button.primary {
    background-color: #0d6efd;
    color: white;
  }

  .session-warning-buttons .button.primary:hover {
    background-color: #0b5ed7;
    transform: translateY(-1px);
  }

  .session-warning-buttons .button.secondary {
    background-color: #6c757d;
    color: white;
  }

  .session-warning-buttons .button.secondary:hover {
    background-color: #5c636a;
    transform: translateY(-1px);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 480px) {
    .session-warning-dialog {
      padding: 1.5rem;
      margin: 1rem;
    }
    
    .session-warning-buttons {
      flex-direction: column;
    }
    
    .session-warning-buttons .button {
      width: 100%;
    }
  }

  .net-banner {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 0.95rem;
  }
  .net-banner.offline {
    background: #FFF1F1;
    color: #7A271A;
    border-bottom: 1px solid #F5B5B5;
  }
  .net-banner.online {
    background: #EFFDF6;
    color: #03543F;
    border-bottom: 1px solid #A7F3D0;
  }
</style>
