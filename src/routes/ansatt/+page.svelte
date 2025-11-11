<script>
  import { getIdPortenLoginUrl } from '../../lib/useApi'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import CardButton from '../../lib/components/CardButton.svelte'
  import { t } from 'svelte-i18n';
  import { derived } from 'svelte/store';
  import TimelineStepper from '$lib/components/TimelineStepper.svelte';
  import { locale } from '$lib/i18n';

  const keyIcon = getThemeAsset('images/key.svg')
  const verifiedIcon = getThemeAsset('images/verify.svg')

  let errorMessage = null
  let loading = false

  let currentLocale = 'nb';
  const unsubscribe = locale.subscribe((value) => {
    currentLocale = value;
  });

  const getShortLocale = (locale) => locale && locale.split('-')[0];

  const redirect = async () => {
    errorMessage = null
    try {
      loading = true
      const shortLocale = getShortLocale(currentLocale);
      console.log('Requesting ID-porten login URL for ansatt/verifyuser with locale:', shortLocale)
      // Only support 'verifyuser' action - streamlined FINT-only flow
      const { loginUrl } = await getIdPortenLoginUrl('ansatt', 'verifyuser', shortLocale)
      console.log('Received login URL:', loginUrl)
      loading = false
      window.location.href = loginUrl
    } catch (error) {
      loading = false
      console.error('Error getting ID-porten login URL:', error)
      errorMessage = error.response?.data?.message || error.toString()
    }
  }

  // i18n derived stores for CardButton
  const verifyHeader = derived(t, $t => $t('ansatt.header'));
  const verifyImgAlt = derived(t, $t => $t('ansatt.imgAlt'));
  const verifyParagraph = derived(t, $t => $t('ansatt.paragraph'));

  $: steps = [
    $t('timeline.start'),
    $t('timeline.idporten'),
    $t('timeline.account'),
    $t('timeline.verified')
  ];
  let currentStep = 0;

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.employee.title')) {
    document.title = `${$t('page.employee.title')} | Brukerkonto`;
  }
</script>

<svelte:head>
</svelte:head>

<TimelineStepper {steps} {currentStep} />

<main>
  <h1 class="visually-hidden">{$t('page.employee.heading')}</h1>
  {#if errorMessage}
    <div class="centerstuff">
      <div class="error">
        <h2 class="errorTitle">{$t('error.title')}</h2>
        <p>{errorMessage}</p>
      </div>
    </div>
  {/if}
  <div class="centerstuff">
    <CardButton 
      header={$verifyHeader}
      imgPath={verifiedIcon}
      imgAlt={$verifyImgAlt}
      gotoPath=""
      paragraph={$verifyParagraph}
      boolValue={false}
      loading={loading}
      func={() => redirect()}
    />
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
</style>