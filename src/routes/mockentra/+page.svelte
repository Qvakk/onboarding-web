<script>
  import { t } from 'svelte-i18n';
  import { page } from '$app/stores'
  import TimelineStepper from '$lib/components/TimelineStepper.svelte';
  const mockLogin = () => {
    const action = $page.url.searchParams.get('action')
    if (!action) {
      throw new Error('Mangler query param ACTION!')
    }
    const allowed = ['mfa', 'pwd', 'stats', 'debug', 'resetmfa', 'validation', 'mfareset']
    if (!allowed.includes(action)) {
      throw new Error(`query param action must be one of: ${allowed.join(', ')}`)
    }
    if (['mfa','validation'].includes(action)) {
      window.location.href = '/validationcallback?code=mockcode&state=mockstate'
    } else if (action === 'pwd') {
      window.location.href = '/entrapwdcallback?code=mockcode&state=mockstate'
    } else if (action === 'stats') {
      window.location.href = '/adminauthcallback?code=mockcode&state=stats-mock-123'
    } else if (action === 'debug') {
      window.location.href = '/adminauthcallback?code=mockcode&state=debug-mock-456'
    } else if (['resetmfa','mfareset'].includes(action)) {
      window.location.href = '/resetmfacallback?code=mockcode&state=resetmock'
    }
  }

  $: steps = [
    $t('timeline.start'),
    $t('timeline.idporten'),
    $t('timeline.account'),
    $t('timeline.verified')
  ];
  let currentStep = 2;
</script>

<TimelineStepper {steps} {currentStep} />

<div class="centerstuff">
  <h2>MOCKE-ENTRA</h2>
  <button class="mock-button" on:click={mockLogin}>Lat som du logger på EntraID</button>
  <p>Ingen data ellerno vil bli hentet/sendt, dette skjer bare lokalt i browser</p>
</div>

<style>
.centerstuff {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0 auto;
}
</style>
