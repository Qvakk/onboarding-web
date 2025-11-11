<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import SmsSuccessRedirect from '$lib/components/SmsSuccessRedirect.svelte';
  
  let confirmationState = '';
  let phoneNumber = '';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.smssent.title')) {
    document.title = `${$t('page.smssent.title')} | Brukerkonto`;
  }

  onMount(() => {
    confirmationState = $page.url.searchParams.get('state') || '';
    phoneNumber = $page.url.searchParams.get('phone') || '';
    
    if (!confirmationState) {
      goto('/');
    }
  });
</script>

<svelte:head>
</svelte:head>

{#if confirmationState}
  <SmsSuccessRedirect 
    {confirmationState} 
    {phoneNumber}
  />
{/if}
