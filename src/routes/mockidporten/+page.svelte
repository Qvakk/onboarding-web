<script>
  import { t } from 'svelte-i18n';
  import { page } from '$app/stores'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import TimelineStepper from '$lib/components/TimelineStepper.svelte';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.mockidporten.title')) {
    document.title = `${$t('page.mockidporten.title')} | Brukerkonto`;
  }

  const mockIcon = getThemeAsset('images/idporten.svg')

  const mockLogin = () => {
    const action = $page.url.searchParams.get('action')
  const demo = $page.url.searchParams.get('demo')
    if (!action) {
      throw new Error('Mangler query param ACTION!')
    }
  const demoSuffix = demo ? `&demo=${encodeURIComponent(demo)}` : ''
  window.location.href = `/idportencallback?code=mockcode&iss=mockiss&state=mock${action}${demoSuffix}`
  }

  $: steps = [
    $t('timeline.start'),
    $t('timeline.idporten'),
    $t('timeline.account'),
    $t('timeline.verified')
  ];
  let currentStep = 1; // Set this as needed for the page
</script>

<svelte:head>
</svelte:head>

<TimelineStepper {steps} {currentStep} />

<div class="mock-container">
  <h1>{$t('page.mockidporten.heading')}</h1>
  <h2>{$t('mockidporten.title')}</h2>
  <button class="mock-button" on:click={mockLogin}>
    {$t('mockidporten.button')}
  </button>
  <p class="mock-info">
    {$t('mockidporten.info')}
  </p>
</div>
