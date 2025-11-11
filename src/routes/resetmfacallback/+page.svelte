<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import IconSpinner from '$lib/components/Icons/IconSpinner.svelte'
  // InfoBox removed for error handling; using modal dialog instead
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'

  // Route params not used; removed unused export to avoid warning
  import { resetMfaMethods } from '$lib/useApi'
  import { t } from 'svelte-i18n'

  /* States:
     pre-warning  -> show initial warning BEFORE deletion
     deleting     -> deletion in progress (API call)
     post-warning -> deletion finished, show results + retry/continue options
     incomplete   -> deletion incomplete, show separate retry dialog
     error        -> error state
  */
  let state = 'pre-warning'
  let showPreWarningDialog = false
  let showPostDeletionDialog = false
  let showIncompleteDialog = false
  let error
  let showErrorDialog = false
  let deletionResults = null
  let validationUrl = null
  let codeParam = null
  let resetStateParam = null
  let deletionInProgress = false
  let fallbackGenerating = false
  let retryCount = 0
  let isRetrying = false
  let retryCountdown = 0
  const MAX_RETRY_ATTEMPTS = 3

  onMount(() => {
    codeParam = $page.url.searchParams.get('code')
    resetStateParam = $page.url.searchParams.get('state')
    if (!(codeParam && resetStateParam)) return goto('/')
    // We deliberately do NOT start deletion yet; user must confirm first.
    showPreWarningDialog = true
  })

  async function startDeletion() {
    if (state !== 'pre-warning') return
    showPreWarningDialog = false
    state = 'deleting'
    deletionInProgress = true
    try {
      const resp = await resetMfaMethods(codeParam, resetStateParam)
      deletionResults = resp
      validationUrl = resp.validationLoginUrl
      state = 'post-warning'
      showPostDeletionDialog = true
    } catch (e) {
      const errorData = e.response?.data
      if (e.response?.status === 409 && errorData?.canRetry) {
        // Incomplete deletion - show retry/admin options
        deletionResults = errorData
        state = 'incomplete'
        showIncompleteDialog = true
      } else {
        error = errorData?.message || e.stack || e.toString()
        state = 'error'
        showErrorDialog = true
      }
    }
  }

  async function startRetryWithDelay() {
    isRetrying = true
    retryCountdown = 5
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      retryCountdown--
      if (retryCountdown <= 0) {
        clearInterval(countdownInterval)
        redirectToFreshMfaReset()
      }
    }, 1000)
  }

  async function redirectToFreshMfaReset() {
    retryCount++
    isRetrying = false
    retryCountdown = 0
    
    try {
      // Always redirect to fresh MFA reset flow for retries
      // This ensures clean OAuth state and avoids token reuse issues
      if (!deletionResults?.fullCorrelationId) {
        error = 'Missing correlation ID for MFA reset retry'
        state = 'error'
        showErrorDialog = true
        return
      }

      // Get fresh MFA reset login URL with the correlation ID
      const response = await fetch(`${import.meta.env.VITE_ONBOARDING_API_URI}/ResetMfaLoginUrl?correlation_id=${encodeURIComponent(deletionResults.fullCorrelationId)}`, {
        headers: { 'x-functions-key': import.meta.env.VITE_ONBOARDING_API_PUBLIC_KEY }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to get MFA reset URL: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.loginUrl) {
        // Redirect to fresh MFA reset authentication flow
        window.location.replace(data.loginUrl)
      } else {
        throw new Error('No login URL returned from MFA reset request')
      }
    } catch (e) {
      error = `Failed to start fresh MFA reset: ${e.message}`
      state = 'error'
      showErrorDialog = true
    }
  }



  async function proceedToValidation() {
  if (!validationUrl) {
      // Try to construct a fresh validation login url if backend didn't supply one
      if (deletionResults?.fullCorrelationId && deletionResults?.userPrincipalName) {
        // Navigate to backend endpoint to request new validation login url
        // We reuse existing EntraValidationLoginUrl endpoint which accepts login_hint + correlation_id
        fallbackGenerating = true
        if (import.meta.env.VITE_MOCK_API && import.meta.env.VITE_MOCK_API === 'true') {
          // In mock mode just craft the url directly
          validationUrl = `/mockentra?action=mfa&correlation_id=${deletionResults.fullCorrelationId}`
          window.location.replace(validationUrl)
          return
        }
        try {
          const response = await fetch(`${import.meta.env.VITE_ONBOARDING_API_URI}/EntraValidationLoginUrl?login_hint=${encodeURIComponent(deletionResults.userPrincipalName)}&correlation_id=${encodeURIComponent(deletionResults.fullCorrelationId)}`, {
            headers: { 'x-functions-key': import.meta.env.VITE_ONBOARDING_API_PUBLIC_KEY }
          })
          
          if (!response.ok) throw new Error('Kunne ikke generere valideringslenke på nytt')
          
          const data = await response.json()
          validationUrl = data.loginUrl
          if (validationUrl) {
            await new Promise(resolve => setTimeout(resolve, 3000))
            window.location.replace(validationUrl)
          } else {
            throw new Error('Svar manglet loginUrl')
          }
        } catch (err) {
          error = `Mangler valideringslenke etter tilbakestilling og klarte ikke generere på nytt: ${err.message}`
          state = 'error'
          showErrorDialog = true
        } finally {
          fallbackGenerating = false
        }
        return
      } else {
        error = 'Mangler valideringslenke etter tilbakestilling. Start prosessen på nytt.'
    state = 'error'
    showErrorDialog = true
        return
      }
    }
    await new Promise(resolve => setTimeout(resolve, 3000))
    window.location.replace(validationUrl)
  }
</script>

<div class="centerstuff">
  {#if state === 'pre-warning'}
    <!-- Empty container; modal handles content -->
  {:else if state === 'deleting'}
    <div class="loading">
      <IconSpinner />
      <p class="loadingMessage">{retryCount > 0 ? `Retry ${retryCount}/${MAX_RETRY_ATTEMPTS}: ${$t('verifyuser.mfa_reset_deleting')}` : $t('verifyuser.mfa_reset_deleting')}</p>
    </div>
  {:else if state === 'post-warning'}
    <!-- Empty container; modal will show summary -->
  {:else if state === 'incomplete'}
    <!-- Empty container; modal will show incomplete dialog -->
  {:else if state === 'error'}
    <!-- Empty; error dialog modal will show -->
  {/if}
</div>

<!-- Pre-warning modal dialog -->
<ConfirmDialog
  open={showPreWarningDialog}
  title={$t('verifyuser.mfa_pre_delete_title') || 'Prepare MFA deletion'}
  confirmLabel={$t('verifyuser.mfa_start_delete_confirm') || $t('verifyuser.mfa_continue_button') || 'Continue'}
  cancelLabel={$t('verifyuser.dialog_reset_mfa.cancel')}
  on:confirm={startDeletion}
  on:cancel={() => { showPreWarningDialog = false; state = 'cancelled'; goto('/') }}
  destructive
  width="520px"
>
  <p><strong>{$t('verifyuser.mfa_pre_delete_message') || 'We are ready to delete your current MFA methods.'}</strong></p>
  <p><small>{$t('verifyuser.mfa_pre_delete_notice') || 'When you press Continue the deletion starts.'}</small></p>
</ConfirmDialog>

<!-- Post-deletion modal dialog -->
<ConfirmDialog
  open={showPostDeletionDialog}
  title={deletionResults?.allDeleted ? ($t('verifyuser.mfa_reset_success_title') || 'MFA methods deleted') : ($t('verifyuser.mfa_reset_incomplete_title') || 'MFA reset incomplete')}
  confirmLabel={deletionResults?.allDeleted ? ($t('verifyuser.mfa_continue_to_validation') || $t('verifyuser.mfa_continue_button')) : (retryCount >= MAX_RETRY_ATTEMPTS ? ($t('verifyuser.mfa_contact_helpdesk') || 'Contact Helpdesk') : ($t('verifyuser.mfa_reset_retry_button') || 'Retry'))}
  cancelLabel={$t('verifyuser.dialog_reset_mfa.cancel')}
  disableConfirm={!deletionResults?.allDeleted && (isRetrying || retryCountdown > 0)}
  loading={isRetrying || retryCountdown > 0}
  on:confirm={() => {
    if (deletionResults?.allDeleted) {
      proceedToValidation()
    } else if (retryCount >= MAX_RETRY_ATTEMPTS) {
      // Contact helpdesk
      goto('/help')
    } else {
      startRetryWithDelay()
    }
  }}
  on:cancel={() => { showPostDeletionDialog = false; goto('/') }}
  width="520px"
>
  {#if deletionResults?.allDeleted}
    <p>{$t('verifyuser.mfa_post_delete_message') || $t('verifyuser.mfa_reset_success_message')}</p>
  {:else}
    <p><strong>{$t('verifyuser.mfa_reset_incomplete_message') || 'Some MFA methods could not be deleted automatically.'}</strong></p>
    <p>{$t('verifyuser.mfa_reset_partial_success', { 
      values: { 
        removed: deletionResults?.removedCount || 0, 
        total: (deletionResults?.removedCount || 0) + (deletionResults?.keptCount || 0), 
        remaining: deletionResults?.keptCount || 0 
      } 
    }) || `Deleted ${deletionResults?.removedCount || 0} methods. ${deletionResults?.keptCount || 0} methods remain.`}</p>
    
    {#if retryCountdown > 0}
      <p><strong>{$t('verifyuser.mfa_retry_countdown', { values: { seconds: retryCountdown } }) || `Retry in ${retryCountdown} seconds...`}</strong></p>
    {:else if retryCount >= MAX_RETRY_ATTEMPTS}
      <p><strong>{$t('verifyuser.mfa_reset_admin_message') || 'Some methods require administrator permissions to delete. Please contact your IT administrator.'}</strong></p>
      <p><em>{$t('verifyuser.mfa_max_retries_reached', { values: { count: retryCount } }) || `Attempted ${retryCount} times. Please contact helpdesk for assistance.`}</em></p>
    {:else if retryCount > 0}
      <p><em>{$t('verifyuser.mfa_retry_attempt', { values: { current: retryCount, max: MAX_RETRY_ATTEMPTS } }) || `Retry attempt ${retryCount} of ${MAX_RETRY_ATTEMPTS}`}</em></p>
      <p><small><em>{$t('verifyuser.mfa_fresh_auth_required') || 'Note: You will be redirected to start the MFA reset process again.'}</em></small></p>
    {:else}
      <p><em>{$t('verifyuser.mfa_continue_disabled') || 'Continue button is disabled until all methods are removed.'}</em></p>
    {/if}
  {/if}
  {#if deletionResults}
    <div class="deletion-summary">
      <p><strong>{$t('verifyuser.mfa_methods_deleted') || 'Methods deleted'}:</strong> {deletionResults.removedCount}</p>
    </div>
  {/if}
  {#if !validationUrl}
    {#if fallbackGenerating}
      <p>Genererer valideringslenke ...</p>
    {:else}
      <p style="color: var(--error-60,#d92d20); font-weight:bold;">URL mangler – forsøk å fortsette for å generere den på nytt.</p>
    {/if}
  {/if}
</ConfirmDialog>

<!-- Incomplete deletion dialog -->
<ConfirmDialog
  open={showIncompleteDialog}
  title={$t('verifyuser.mfa_reset_incomplete_title') || 'MFA reset incomplete'}
  confirmLabel={deletionResults?.requiresAdminIntervention ? ($t('verifyuser.mfa_reset_admin_required') || 'Contact Admin') : ($t('verifyuser.mfa_reset_retry_button') || 'Retry')}
  cancelLabel={$t('verifyuser.dialog_reset_mfa.cancel') || 'Cancel'}
  on:confirm={() => {
    if (deletionResults?.requiresAdminIntervention) {
      // Contact admin - could redirect to help page or show admin contact info
      goto('/help')
    } else {
      redirectToFreshMfaReset()
    }
  }}
  on:cancel={() => { showIncompleteDialog = false; goto('/') }}
  destructive={!deletionResults?.requiresAdminIntervention}
  width="520px"
>
  <p>{$t('verifyuser.mfa_reset_incomplete_message') || 'Some MFA methods could not be deleted automatically.'}</p>
  {#if deletionResults}
    <p><strong>{$t('verifyuser.mfa_reset_partial_success', { 
      values: { 
        removed: deletionResults.removedCount || 0, 
        total: (deletionResults.removedCount || 0) + (deletionResults.remainingCount || 0), 
        remaining: deletionResults.remainingCount || 0 
      } 
    }) || `Deleted ${deletionResults.removedCount || 0} methods. ${deletionResults.remainingCount || 0} methods remain.`}</strong></p>
    
    {#if deletionResults.requiresAdminIntervention}
      <p><em>{$t('verifyuser.mfa_reset_admin_message') || 'Some methods require administrator permissions to delete. Please contact your IT administrator.'}</em></p>
    {/if}
    
    {#if deletionResults.errors && deletionResults.errors.length > 0}
      <details style="margin-top: 1rem;">
        <summary>Technical details</summary>
        <ul style="text-align: left; font-size: 0.9rem;">
          {#each deletionResults.errors as err}
            <li>{err.segment || 'Unknown'}: {err.error || err.body || `Status ${err.status}`}</li>
          {/each}
        </ul>
      </details>
    {/if}
  {/if}
</ConfirmDialog>

<!-- Error modal dialog -->
<ConfirmDialog
  open={showErrorDialog}
  title={$t('error.title')}
  confirmLabel={$t('verifyuser.try_again') || 'Try again'}
  cancelLabel={$t('verifyuser.back_to_home') || $t('resetpassord.back_to_home') || 'Home'}
  on:confirm={() => { showErrorDialog = false; goto('/') }}
  on:cancel={() => { showErrorDialog = false; goto('/') }}
  width="520px"
>
  <p style="white-space:pre-wrap;">{error}</p>
  {#if deletionResults}
    <div class="deletion-summary" style="margin-top:1rem;">
      <p><strong>{$t('verifyuser.mfa_methods_deleted') || 'Methods deleted'}:</strong> {deletionResults.removedCount}</p>
      {#if typeof deletionResults.keptCount === 'number'}
        <p><strong>Kept:</strong> {deletionResults.keptCount}</p>
      {/if}
      {#if deletionResults.totalAuthMethodsBefore}
        <p><small>Total before: {deletionResults.totalAuthMethodsBefore}</small></p>
      {/if}
    </div>
  {/if}
</ConfirmDialog>

<style>
  .loading { 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    gap: 10px; 
    padding: 40px 0; 
  }
  
  .loadingMessage { 
    font-size: 1rem; 
  }
  
  .deletion-summary {
    background-color: #f8f9fa;
    border-radius: 6px;
    padding: 1rem;
    margin: 1rem 0;
    text-align: left;
  }
  
  .deletion-summary p {
    margin: 0.5rem 0;
  }
  

  
  
  :global(.centerstuff) {
    max-width: 600px;
    margin: 2rem auto;
    padding: 1rem;
  }
</style>
