<script>
  import { getIdPortenLoginUrl } from '../../lib/useApi'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import CardButton from '../../lib/components/CardButton.svelte'
  import { t } from 'svelte-i18n';
  import { derived } from 'svelte/store';
  import TimelineStepper from '$lib/components/TimelineStepper.svelte';
  import { locale } from '$lib/i18n';

  const keyIcon = getThemeAsset('images/key.svg')
  const verifiedIcon = getThemeAsset('images/verified.svg')

  let errorMessage = null
  let loadingAction = null // Changed from loading = false

  let currentLocale;
  locale.subscribe(value => currentLocale = value);

  const getShortLocale = (locale) => locale && locale.split('-')[0];

  const redirect = async () => {
    errorMessage = null
    try {
      loadingAction = 'verifyuser'
      const shortLocale = getShortLocale(currentLocale);
      // Only support 'verifyuser' action - streamlined FINT-only flow
      const { loginUrl } = await getIdPortenLoginUrl('elev', 'verifyuser', shortLocale)
      window.location.href = loginUrl
    } catch (error) {
      loadingAction = null // Reset loading state
      errorMessage = error.response?.data?.message || error.toString()
    }
  }

  // i18n derived stores for CardButton
  const verifyHeader = derived(t, $t => $t('elev.header'));
  const verifyImgAlt = derived(t, $t => $t('elev.imgAlt'));
  const verifyParagraph = derived(t, $t => $t('elev.paragraph'));

  $: steps = [
    $t('timeline.start'),
    $t('timeline.idporten'),
    $t('timeline.account'),
    $t('timeline.verified')
  ];
  let currentStep = 0;

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.student.title')) {
    document.title = `${$t('page.student.title')} | Brukerkonto`;
  }
</script>

<svelte:head>
</svelte:head>

<TimelineStepper {steps} {currentStep} />

<main>
  <h1 class="visually-hidden">{$t('page.student.heading')}</h1>
  {#if errorMessage}
    <div class="centerstuff">
      <div class="error">
        <h3 class="errorTitle">{$t('error.title')}</h3>
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
      loading={loadingAction === 'verifyuser'}
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