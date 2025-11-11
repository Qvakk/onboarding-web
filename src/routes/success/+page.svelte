<script>
  import { onMount } from 'svelte'
  import { entraMfaAuth } from '../../lib/useApi'
  import { page } from '$app/stores'
  import IconSpinner from '../../lib/components/Icons/IconSpinner.svelte'
  import { goto } from '$app/navigation'
  import { t } from 'svelte-i18n';
  import TimelineStepper from '$lib/components/TimelineStepper.svelte';
  import { getThemeAsset } from '$lib/themes/theme.config';

  const verifiedIcon = getThemeAsset('images/verified.svg');

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Redirect configuration
  let countdown = 5;
  let countdownInterval = null;

  let loadingMessage = $t('success.verifying_login');

  const fakeLoadingMessages = async () => {
    const interval = 1500;
    await sleep(interval);
    loadingMessage = $t('success.verifying_login');
    await sleep(interval);
    loadingMessage = $t('success.still_verifying_login');
  };

  // Entra logout
  let entraErrorMessage;
  let entraLoading;

  // Entra ID auth
  let entraResponse;

  const entraAuthentication = async (code, state) => {
    try {
      entraResponse = await entraMfaAuth(code, state);
      
      // Start countdown for redirect after successful auth
      if (entraResponse && !entraResponse.hasError) {
        startCountdown();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.stack || error.toString();
      entraResponse = { hasError: true, message: errorMsg };
    }
  };

  const startCountdown = () => {
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        handleRedirect();
      }
    }, 1000);
  };

  const handleRedirect = () => {
    if (countdownInterval) clearInterval(countdownInterval);
    
    const userType = entraResponse?.userType?.toLowerCase();
    let redirectUrl = '/';
    
    // Get redirect URLs from Vite environment variables
    const ansattUrl = import.meta.env.VITE_SUCCESS_REDIRECT_ANSATT_URL;
    const elevUrl = import.meta.env.VITE_SUCCESS_REDIRECT_ELEV_URL;
    
    if (userType === 'ansatt' && ansattUrl) {
      redirectUrl = ansattUrl;
    } else if (userType === 'elev' && elevUrl) {
      redirectUrl = elevUrl;
    }
    
    window.location.href = redirectUrl;
  };

  onMount(() => {
    const code = $page.state.code;
    const state = $page.state.state;
    if (!(code && state)) {
      goto('/');
    } else {
      entraAuthentication(code, state);
      fakeLoadingMessages();
    }
  });

  let currentStep = 4;
  $: steps = [
    $t('timeline.start'),
    $t('timeline.idporten'),
    $t('timeline.account'),
    $t('timeline.verified')
  ]

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.success.title')) {
    document.title = `${$t('page.success.title')} | Brukerkonto`;
  }
</script>

<svelte:head>
</svelte:head>

<TimelineStepper {steps} {currentStep} />

<main>
  <h1 class="visually-hidden">{$t('page.success.heading')}</h1>

<div class="centerstuff">
  {#if !entraResponse}
    <div class="loading">
      <IconSpinner />
      <p class="loadingMessage">{loadingMessage}...</p>
    </div>
  {:else if entraResponse.hasError}
    <h2 class="errorTitle">{$t('error.title')}</h2>
    <p style="text-align:center">{entraResponse.message}</p>
    <button class="mock-button" on:click={() => goto('/')}>{$t('success.to_home')}</button>
  {:else}
    <h3>
      {#if entraResponse.givenName}
        {$t('success.hello')}, {entraResponse.givenName}!
      {:else}
        {$t('success.hello')}
      {/if}
    </h3>
    <div class="section">
      <p>{$t('success.account_ready')}</p>
    </div>
    <div class="verified-icon-wrapper">
      <img src={verifiedIcon} alt="Verified" class="verified-icon" />
    </div>
    <div class="section account-block">
      <p class="username-line"><strong>{$t('success.username')}:</strong> {entraResponse.userPrincipalName}</p>
    </div>
    
    {#if countdown > 0}
      <div class="redirect-info">
        <p>{$t('success.redirecting_in')} {countdown}...</p>
        <button class="start-journey-button" on:click={handleRedirect}>
          {$t('success.start_journey')}
        </button>
      </div>
    {/if}
  {/if}
</div>

</main>

<style>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.verified-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  margin-bottom: 1.5rem;
}
.verified-icon {
  width: 150px;
  height: 150px;
  display: block;
}
.centerstuff {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0 auto;
}
.mock-button {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  border-radius: 8px;
  border: none;
  background: var(--primary-color, #0176ac);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
}
.loadingMessage {
  margin-top: 1rem;
  color: var(--spinner-color, #0176ac);
  font-size: 1.1rem;
}
.section { margin: 12px 0px; }
.account-block { text-align: center; }
.username-line { margin: 0; }
.redirect-info {
  margin-top: 2.5rem;
  text-align: center;
}
.redirect-info p {
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  color: var(--text-color, #333);
  font-weight: 500;
}
.start-journey-button {
  margin-top: 0.5rem;
  padding: 1rem 2.5rem;
  border-radius: 8px;
  border: none;
  background: var(--primary-color, #0176ac);
  color: #fff;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.start-journey-button:hover {
  background: var(--primary-color-dark, #015a8a);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}
.start-journey-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>