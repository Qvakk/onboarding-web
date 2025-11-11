<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import InfoBox from '../../lib/components/InfoBox.svelte'
  import { t } from 'svelte-i18n';

  onMount(() => {
    // Password authentication flow has been removed - redirect to home
    console.log('Password authentication flow no longer supported - redirecting to home')
    setTimeout(() => goto('/'), 3000)
  })
</script>

<div class="centerstuff">
  <InfoBox type="info">
    <h2>Funksjonalitet ikke lenger tilgjengelig</h2>
    <p>Passordautentisering-funksjonen har blitt fjernet som en del av systemoppgraderingen.</p>
    <p>Du blir automatisk videresendt til forsiden om 3 sekunder...</p>
    <div style="margin-top: 1rem;">
      <a href="/" class="btn">Gå til forsiden nå</a>
    </div>
  </InfoBox>
</div>