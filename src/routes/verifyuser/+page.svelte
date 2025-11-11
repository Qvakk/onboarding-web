<script>
  import { onMount, onDestroy } from 'svelte'
  import { getEntraValidationLoginUrl, verifyUser, confirmPhoneAndSendSms, getResetMfaLoginUrl } from '../../lib/useApi'
  import { page } from '$app/stores'
  import IconSpinner from '../../lib/components/Icons/IconSpinner.svelte'
  import { goto } from '$app/navigation'
  import InfoBox from '../../lib/components/InfoBox.svelte'
  import { t, locale } from 'svelte-i18n'
  import TimelineStepper from '$lib/components/TimelineStepper.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import PasswordVerification from '$lib/components/PasswordVerification.svelte'

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
  let loadingMessage = $t('verifyuser.verifying_login')

  // Incoming params
  let code, iss, stateParam

  // Flow state
  let showMfaDialog = false
  let showSmsDialog = false
  let showPhoneConfirmDialog = false // New: First step - confirm phone number
  let showPasswordDialog = false // Password verification dialog for hybrid flow
  let showPasswordSuccessDialog = false // Success dialog after password is set
  let cancelled = false
  let verifying = false
  let isExistingAccountMfa = false
  
  // MFA Reset dialog state
  let showMfaInfoDialog = false // Step 1: Information about existing account
  
  let sendingSms = false
  let editingPhone = false
  
  // Password verification state
  let passwordData = null // Holds confirmationState for password verification
  let passwordSuccessData = null // Holds data after successful password set
  let countdown = 10 // Countdown timer for auto-redirect
  let countdownInterval = null
  let newPhone = ''
  let errRefId = ''
  let errMessage = ''
  const friendlyError = (error) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return $t('errors.offline') || 'You are offline. Please check your connection.'
      
      // Check for specific error messages from the API
      const apiMessage = error?.response?.data?.message
      if (apiMessage === 'no_phone_available') {
        return $t('verifyuser.no_phone_available') || 'No phone number available. Please change your phone number to continue.'
      }
      
      const status = error?.status
      if (!status) {
        // Network or unknown fetch error
        return $t('errors.network') || 'Network error. Please try again.'
      }
      if (status === 429) return $t('errors.too_many_requests') || 'Too many requests. Please wait and try again.'
      if (status === 400 || status === 422) return $t('errors.bad_request') || 'There is a problem with the information provided.'
      if (status === 401) return $t('errors.unauthorized') || 'Your session has expired. Please start again.'
      if (status === 403) return $t('errors.forbidden') || 'You do not have permission to continue.'
      if (status === 404) return $t('errors.not_found') || 'We could not find what you requested.'
      if (status === 409) return $t('errors.conflict') || 'This action could not be completed because of a conflict.'
      if (status >= 500) return $t('errors.server_issue') || 'We have a temporary issue. Please try again later.'
      return $t('errors.generic') || 'Something went wrong. Please try again.'
    } catch (_) {
      return 'Something went wrong. Please try again.'
    }
  }

  // Data from backend
  let verifyUserResponse
  let smsData = null // holds confirmationState etc when new account
  const maskPhone = (value) => {
    if (!value) return ''
    const digits = String(value).replace(/\D+/g, '')
    if (digits.length <= 3) return `*****${digits}`
    const tail = digits.slice(-3)
    return `*****${tail}`
  }
  $: displayPhone = smsData?.maskedPhoneNumber || maskPhone(smsData?.phoneNumber)

  // Demo / mock mode via env (normalize common truthy values)
  const normalizeBool = (v) => ['1','true','yes','y'].includes(String(v ?? '').toLowerCase())
  const MOCK_API = normalizeBool(import.meta.env.VITE_MOCK_API)
  const ENV_MODE = (import.meta.env.VITE_MOCK_MODE || '').toLowerCase().trim()

  // Minimal HTML escape to safely inject values into {@html}-based i18n strings
  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  // Returns { loginUrl } on success (existing flow), or null if phone confirmation is needed
  const startVerify = async () => {
    try {
      verifyUserResponse = await verifyUser(code, iss, stateParam)
      if (verifyUserResponse?.requiresPhoneConfirmation) {
        smsData = verifyUserResponse
        // Clear any previous error state when showing dialog fresh
        smsData.error = ''
        errRefId = ''
        errMessage = ''
        showPhoneConfirmDialog = true  // Show phone confirmation first
        return null
      }
      // If backend already provided a loginUrl (existing accounts), use it directly
      if (verifyUserResponse?.loginUrl) {
        return { loginUrl: verifyUserResponse.loginUrl }
      }
  const { correlationId, userPrincipalName } = verifyUserResponse
  const { loginUrl } = await getEntraValidationLoginUrl(userPrincipalName, correlationId)
      return { loginUrl }
    } catch (error) {
      const errorMsg = friendlyError(error)
      verifyUserResponse = { hasError: true, message: errorMsg, correlationId: error?.correlationId || null }
      return null
    }
  }

  const confirmMfaReset = async () => {
    try {
      showMfaDialog = false
      verifying = true
      loadingMessage = $t('verifyuser.mfa_reset_wait')
      
      // Check if we already have a loginUrl from existing account flow
      if (verifyUserResponse?.loginUrl) {
        // Use replace() to avoid leaving the interim page in history
        window.location.replace(verifyUserResponse.loginUrl)
        return
      }
      
      // Otherwise, get MFA reset URL (fallback for manual MFA reset requests)
      const loginHint = verifyUserResponse?.userPrincipalName
      if (!verifyUserResponse) {
        await startVerify()
      }
      if (!verifyUserResponse?.correlationId) throw new Error('Mangler correlationId før reset')
      const { loginUrl } = await getResetMfaLoginUrl(loginHint, verifyUserResponse.correlationId)
      // Use replace() to avoid leaving the interim page in history
      window.location.replace(loginUrl)
    } catch (err) {
      verifyUserResponse = { hasError: true, message: friendlyError(err), correlationId: err?.correlationId || null }
      verifying = false
    }
  }
  const cancelMfaReset = () => { showMfaDialog = false; cancelled = true }

  // MFA Reset multi-step handlers
  const startMfaReset = async () => {
    try {
      showMfaInfoDialog = false
      verifying = true
      loadingMessage = $t('verifyuser.mfa_login_wait') || 'Redirecting to login...'
      
      // Get MFA reset login URL
      const loginHint = verifyUserResponse?.userPrincipalName
      if (!verifyUserResponse?.correlationId) throw new Error('Missing correlationId for MFA reset')
      
      const { loginUrl } = await getResetMfaLoginUrl(loginHint, verifyUserResponse.correlationId)
      
      // Redirect to MFA reset login
      window.location.replace(loginUrl)
    } catch (err) {
      verifyUserResponse = { hasError: true, message: friendlyError(err), correlationId: err?.correlationId || null }
      verifying = false
      showMfaInfoDialog = false
    }
  }

  const cancelMfaInfo = () => { 
    showMfaInfoDialog = false
    cancelled = true 
  }

  // Phone confirmation handlers  
  const confirmPhoneNumber = async () => {
    // In the current backend implementation, confirming phone immediately sends SMS
    // So we skip the intermediate dialog and go straight to SMS sending
    showPhoneConfirmDialog = false
    showSmsDialog = true  // Move to SMS creation dialog
  }

  const cancelPhoneConfirm = () => {
    showPhoneConfirmDialog = false
    cancelled = true
    smsData.error = ''
    errRefId = ''
    errMessage = ''
  }

  const sendSmsNow = async () => {
    if (!smsData) return
    
    // Handle missing phone scenario - redirect to KRR
    if (smsData.missingPhone) {
      window.location.href = getKrrUrl()
      return
    }
    
    // Validate inputs BEFORE setting sendingSms flag
    if (editingPhone) {
      const entered = newPhone.trim()
      if (!entered || entered === '+47') {
        smsData.error = $t('verifyuser.no_number')
        return
      }
      if (!phoneValid) {
        smsData.error = $t('verifyuser.invalid_phone')
        return
      }
    } else {
      // When not editing phone, validate that we have a phone number
      if (!displayPhone || displayPhone.trim() === '') {
        smsData.error = $t('verifyuser.no_number') || 'No phone number available'
        return
      }
    }
    
    // Now that validation passed, set loading state
    sendingSms = true
    smsData.error = '' // Clear any previous errors when starting SMS send
    errRefId = ''
    errMessage = ''
    
    try {
      const action = editingPhone
        ? confirmPhoneAndSendSms(smsData.confirmationState, { 
            newPhoneNumber: newPhone.trim(), 
            verificationToken: smsData.verificationToken,
            language: $locale || 'nb' 
          })
        : confirmPhoneAndSendSms(smsData.confirmationState, { language: $locale || 'nb' })
      
      const resp = await action
      
      // Redirect to Entra MFA setup
      if (resp?.validationLoginUrl) {
        // Keep dialog open with loading spinner until redirect completes
        // Don't modify showSmsDialog or sendingSms - maintain loading state
        window.location.href = resp.validationLoginUrl
        // The redirect will navigate away before anything else happens
        return
      }
      
      // If no redirect URL returned, show error
      smsData.error = 'No validation URL received - please try again'
      sendingSms = false
    } catch (error) {
      const msg = friendlyError(error)
      smsData.error = msg
      errRefId = error?.correlationId || ''
      errMessage = msg
      sendingSms = false // Reset on error so user can retry
    }
  }

  const handlePasswordSuccess = async (event) => {
    const { userPrincipalName, correlationId } = event.detail
    
    // Close password dialog and show success dialog immediately
    showPasswordDialog = false
    showPasswordSuccessDialog = true
    
    // Always start countdown
    countdown = 10
    if (countdownInterval) clearInterval(countdownInterval)
    countdownInterval = setInterval(() => {
      countdown -= 1
      if (countdown <= 0) {
        clearInterval(countdownInterval)
        countdownInterval = null
        redirectToMfa()
      }
    }, 1000)
    
    // Get the validation login URL (async, but countdown already started)
    try {
      const response = await getEntraValidationLoginUrl(userPrincipalName, correlationId || '', { flowType: 'new_account' })
      passwordSuccessData = {
        userPrincipalName,
        validationLoginUrl: response.loginUrl
      }
    } catch (error) {
      console.error('Failed to get validation login URL:', error)
      // Fallback: store data without redirect URL
      passwordSuccessData = { userPrincipalName }
    }
  }
  
  const redirectToMfa = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    if (passwordSuccessData?.validationLoginUrl) {
      window.location.href = passwordSuccessData.validationLoginUrl
    }
  }
  
  const phoneRegex = /^\+47\d{8}$/
  $: phoneValid = !editingPhone || phoneRegex.test(newPhone.trim())

  // Function to create KRR URL with current locale
  const getKrrUrl = () => {
    const currentLocale = $locale || 'nb'
    // Map some locales to what KRR supports
    const mappedLocale = currentLocale === 'nn' ? 'nn' : currentLocale === 'se' ? 'se' : 'nb'
    return `https://minprofil.kontaktregisteret.no/?locale=${mappedLocale}`
  }

  // Clear phone validation errors when user changes phone number
  
  // Cleanup countdown interval on component destroy
  onDestroy(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
  })
  $: if (newPhone && smsData?.error && (smsData.error.includes('Invalid phone') || smsData.error.includes('No number'))) {
    if (phoneValid && newPhone.trim() !== '+47') {
      smsData.error = ''
      errRefId = ''
      errMessage = ''
    }
  }

  onMount(() => {
    const demoOverride = ($page.url.searchParams.get('demo') || '').toLowerCase().trim() // 'new' | 'existing' | 'missingphone'
  const MODE = (demoOverride || ENV_MODE || 'new')
  code = $page.state.code
  stateParam = $page.state.state
  iss = $page.state.iss

    // If we are in demo/mock mode and missing auth params, short-circuit UI
  const hasParams = !!(code && stateParam && iss)
  if (!hasParams) {
      if (MOCK_API) {
        if (MODE === 'existing') {
          // Demo mapping: existing => MFA reset dialog
          showMfaDialog = true
        } else if (MODE === 'missingphone') {
          // Demo mapping: missing phone => KRR redirect dialog
          smsData = {
            confirmationState: 'demo',
            phoneNumber: null,
            maskedPhoneNumber: null,
            phoneSource: null,
            canUpdatePhone: true,
            missingPhone: true
          }
          showPhoneConfirmDialog = true  // Start with phone confirmation
        } else {
          // Demo mapping: new (default) => confirm phone dialog
          smsData = {
            confirmationState: 'demo',
            maskedPhoneNumber: '+47 *****123',
            phoneSource: demoOverride === 'fint' ? 'FINT' : 'KRR',
            canUpdatePhone: demoOverride !== 'fint' // KRR allows update, FINT does not
          }
          showPhoneConfirmDialog = true  // Start with phone confirmation
        }
        return
      }
      goto('/')
      return
    }
    // Normal flow: apply env-driven demo mapping even with params
    if (MOCK_API) {
      if (MODE === 'existing') {
        // existing => MFA reset
        showMfaDialog = true
        return
      } else if (MODE === 'missingphone') {
        // missing phone => KRR redirect
        smsData = {
          confirmationState: 'demo',
          phoneNumber: null,
          maskedPhoneNumber: null,
          phoneSource: null,
          canUpdatePhone: true,
          missingPhone: true
        }
        showPhoneConfirmDialog = true  // Start with phone confirmation
        return
      }
      // new => confirm phone
      smsData = {
        confirmationState: 'demo',
        maskedPhoneNumber: '+47 *****123',
        phoneSource: demoOverride === 'fint' ? 'FINT' : 'KRR',
        canUpdatePhone: demoOverride !== 'fint' // KRR allows update, FINT does not
      }
      showPhoneConfirmDialog = true  // Start with phone confirmation
      return
    }
  // Non-mock: immediately start verification to determine flow
  verifying = true
  ;(async () => { 
    const result = await startVerify()
    verifying = false
    if (result?.loginUrl) {
      // Existing account with loginUrl - show initial info dialog
      isExistingAccountMfa = true
      showMfaInfoDialog = true
    } else if (!result && !verifyUserResponse?.hasError && !verifyUserResponse?.requiresPhoneConfirmation) {
      // Only show MFA dialog if startVerify failed and it's not a phone confirmation issue
      showMfaDialog = true
    }
  })()
  })

  let currentStep = 1
  $: steps = [$t('timeline.start'), $t('timeline.idporten'), $t('timeline.account'), $t('timeline.verified')]

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.verifyuser.title')) {
    document.title = `${$t('page.verifyuser.title')} | Brukerkonto`;
  }
</script>

<svelte:head>
</svelte:head>

<TimelineStepper {steps} {currentStep} />

<main>
  <h1 class="visually-hidden">{$t('page.verifyuser.heading')}</h1>

{#if cancelled}
  <div class="centerstuff">
  <p>{$t('verifyuser.cancelled_message')}</p>
  </div>
{:else}
  {#if verifying}
    <div class="loading">
      <IconSpinner />
      <p class="loadingMessage">{loadingMessage}...</p>
    </div>
  {:else if verifyUserResponse?.hasError}
    <div class="centerstuff error-section">
      <div class="error">
        <h3 class="errorTitle">{$t('error.title')}</h3>
        <p>{verifyUserResponse.message}</p>
        {#if verifyUserResponse?.correlationId}
          <p style="margin-top:6px; color:var(--stein-60,#606a78)">{$t('verifyuser.reference_id') || 'Reference ID'}: <code>{verifyUserResponse.correlationId}</code></p>
        {/if}
        <div style="display:flex; gap:5px; align-items:center;">
          <span class="material-symbols-outlined">arrow_back</span>
            <a href="/" class="back-home-btn">{$t('verifyuser.back_to_home')}</a>
        </div>
      </div>
      <br />
      <InfoBox title="Need help?">
        <p>Phone: <a href="tel:{import.meta.env.VITE_SERVICEDESK_TLF.replaceAll(' ', '')}">{import.meta.env.VITE_SERVICEDESK_TLF}</a></p>
        <p>Email: <a href="mailto:{import.meta.env.VITE_SERVICEDESK_EPOST}">{import.meta.env.VITE_SERVICEDESK_EPOST}</a></p>
      </InfoBox>
    </div>
  {:else if verifyUserResponse && !smsData}
    redirecting...
  {/if}
{/if}

<ConfirmDialog
  open={showMfaDialog}
  title={isExistingAccountMfa ? ($t('verifyuser.dialog_setup_mfa.title') || $t('verifyuser.dialog_reset_mfa.title')) : $t('verifyuser.dialog_reset_mfa.title')}
  confirmLabel={$t('verifyuser.dialog_reset_mfa.confirm')}
  cancelLabel={$t('verifyuser.dialog_reset_mfa.cancel')}
  on:confirm={confirmMfaReset}
  on:cancel={cancelMfaReset}
  loading={verifying}
  disableCloseOnBackdrop={true}
>
  <p>{isExistingAccountMfa ? ($t('verifyuser.dialog_setup_mfa.body') || $t('verifyuser.dialog_reset_mfa.body')) : $t('verifyuser.dialog_reset_mfa.body')}</p>
</ConfirmDialog>

<!-- Phone Confirmation Dialog - Step 1 -->
<ConfirmDialog
  open={showPhoneConfirmDialog}
  title={smsData?.missingPhone 
    ? $t('verifyuser.phone_missing_title') 
    : $t('verifyuser.dialog_phone_confirm_title')}
  confirmLabel={smsData?.missingPhone 
    ? $t('verifyuser.update_phone') 
    : $t('verifyuser.dialog_phone_confirm_button')}
  cancelLabel={$t('verifyuser.dialog_phone.cancel')}
  on:confirm={smsData?.missingPhone 
    ? () => window.location.href = getKrrUrl()
    : confirmPhoneNumber}
  on:cancel={cancelPhoneConfirm}
  disableCloseOnBackdrop={true}
>
  {#if smsData?.missingPhone}
    <!-- Missing phone scenario - only show missing phone explanation -->
    <p style="margin-bottom: 16px;">{@html $t('verifyuser.phone_missing_explanation')}</p>
  {:else if displayPhone && displayPhone.trim() !== ''}
    <!-- Normal phone confirmation with KRR source info -->
    <p>{@html $t('verifyuser.dialog_phone_confirm_body', { values: { phone: escapeHtml(displayPhone) } })}</p>
  {:else}
    <p style="color:var(--error-60,#d92d20);">{$t('verifyuser.no_phone_available')}</p>
  {/if}

  <svelte:fragment slot="extraButtons">
    {#if !smsData?.missingPhone && smsData?.canUpdatePhone}
      <!-- Normal case: show Change button -->
      <button class="cd-btn secondary" type="button" on:click={() => window.location.href = getKrrUrl()}>
        {$t('verifyuser.dialog_phone_confirm_change')}
      </button>
    {/if}
    <!-- Missing phone case has no extra buttons - only "Update phone" as confirm button -->
  </svelte:fragment>
</ConfirmDialog>

<ConfirmDialog
  open={showSmsDialog}
  title={sendingSms 
    ? $t('verifyuser.dialog_phone_title.send')
    : (editingPhone
      ? $t('verifyuser.dialog_phone_title.enter')
      : $t('verifyuser.dialog_phone_title.send'))}
  confirmLabel={editingPhone
    ? $t('verifyuser.dialog_phone.confirm_continue') || 'Continue'
    : $t('verifyuser.dialog_phone.confirm_send')}
  cancelLabel={$t('verifyuser.dialog_phone.cancel')}
  loading={sendingSms}
  disableConfirm={editingPhone && (!newPhone?.trim() || newPhone.trim() === '+47' || !phoneValid)}
  disableCloseOnBackdrop={sendingSms}
  on:confirm={sendSmsNow}
  on:cancel={() => { if (!sendingSms) { showSmsDialog = false; cancelled = true; smsData.error = ''; errRefId = ''; errMessage = '' } }}
>
  {#if smsData?.error}
    <div class="err-ribbon" role="alert" aria-live="assertive">
      <span class="material-symbols-outlined" aria-hidden="true">error</span>
      <div class="err-content">
        <p class="err-text">{smsData.error}</p>
        {#if errRefId}
          <p class="err-ref">{$t('verifyuser.reference_id') || 'Reference ID'}: <code>{errRefId}</code></p>
        {/if}
      </div>
      <div class="err-actions">
        <button class="cd-btn secondary" type="button" on:click={() => { if (navigator?.clipboard) { navigator.clipboard.writeText(`${smsData.error}${errRefId ? `\nRef: ${errRefId}` : ''}`) } }}>{$t('verifyuser.copy') || 'Copy'}</button>
      </div>
    </div>
  {/if}
  {#if !editingPhone}
    <!-- Sending SMS with confirmed phone number -->
    <p>{@html $t('verifyuser.sms_creating_message', { values: { phone: escapeHtml(displayPhone) } })}</p>
  {:else}
    <p>{$t('verifyuser.dialog_phone.body_enter')}</p>
    <p style="margin-top:4px; color:var(--stein-50,#667085)">{$t('verifyuser.dialog_phone.krr_update_notice')}</p>
    <input
      type="tel"
      bind:value={newPhone}
      placeholder="+47XXXXXXXX"
      style="width:100%; padding:8px; border:1px solid var(--vann-30,#d3dde6); border-radius:4px;"
      disabled={sendingSms}
    />
    {#if editingPhone && (!newPhone.trim() || newPhone.trim() === '+47')}
      <p style="color:var(--error-60,#d92d20); font-size:0.85rem;" role="alert" aria-live="polite">{$t('verifyuser.no_number')}</p>
    {/if}
    {#if newPhone && newPhone.trim() !== '+47' && !phoneValid}
      <p style="color:var(--error-60,#d92d20); font-size:0.85rem;">{$t('verifyuser.invalid_phone')}</p>
    {/if}
  {/if}

  {#if sendingSms}
    <p style="margin-top: 8px; font-style: italic;">{@html $t('verifyuser.sms_sending_redirect')}</p>
  {/if}

  <svelte:fragment slot="extraButtons">
    {#if editingPhone}
      <button class="cd-btn secondary" type="button" disabled={sendingSms} on:click={() => { editingPhone = false; smsData.error = ''; errRefId = ''; errMessage = '' }}>{$t('verifyuser.back')}</button>
      {#if smsData?.phoneNumber}
        <button class="cd-btn secondary" type="button" disabled={sendingSms} on:click={() => { newPhone = smsData.phoneNumber; smsData.error = ''; errRefId = ''; errMessage = '' }}>{$t('verifyuser.use_current_number')}</button>
      {/if}
    {/if}
  </svelte:fragment>
</ConfirmDialog>

<!-- MFA Reset Multi-Step Dialogs -->
<ConfirmDialog
  open={showMfaInfoDialog}
  title={$t('verifyuser.dialog_mfa_info.title') || 'Existing Account - MFA Setup Required'}
  confirmLabel={$t('verifyuser.dialog_mfa_info.confirm') || 'Continue to Login'}
  cancelLabel={$t('verifyuser.dialog_mfa_info.cancel') || 'Cancel'}
  on:confirm={startMfaReset}
  on:cancel={cancelMfaInfo}
  loading={verifying}
  disableCloseOnBackdrop={true}
>
  <p>{$t('verifyuser.dialog_mfa_info.body') || 'You have an existing account and we need to set up multi-factor authentication (MFA). We will need you to log in with your account using fresh credentials to proceed with MFA configuration.'}</p>
</ConfirmDialog>

<!-- Password Verification Dialog (Hybrid Flow) -->
{#if showPasswordDialog && passwordData}
  <ConfirmDialog
    open={showPasswordDialog}
    title={$t('passwordVerification.title')}
    hideButtons={true}
    disableCloseOnBackdrop={true}
    on:cancel={() => { showPasswordDialog = false; cancelled = true }}
  >
    <div class="password-dialog-content">
      <div class="info-box-password">
        <p>{$t('smsSuccess.message')}</p>
        {#if passwordData.phoneNumber}
          <p class="phone-number">{passwordData.phoneNumber}</p>
        {/if}
        
        {#if import.meta.env.VITE_MOCK_API === 'true'}
          <div class="mock-password-box">
            <p class="mock-label">🔧 MOCK MODE - Your temporary password:</p>
            <p class="mock-password">Demo1234</p>
            <p class="mock-hint">Use this password below</p>
          </div>
        {/if}
      </div>
      
      <PasswordVerification 
        confirmationState={passwordData.confirmationState}
        language={$locale || 'nb'}
        inline={true}
        on:success={handlePasswordSuccess}
      />
    </div>
  </ConfirmDialog>
{/if}

<!-- Password Success Dialog (Hybrid Flow) -->
{#if showPasswordSuccessDialog && passwordSuccessData}
  <ConfirmDialog
    open={showPasswordSuccessDialog}
    title={$t('verifyuser.dialog_password_success.title') || 'Password Set Successfully!'}
    confirmLabel={$t('verifyuser.dialog_password_success.confirm')}
    hideCancel={true}
    disableCloseOnBackdrop={true}
    on:confirm={redirectToMfa}
  >
    <p style="text-align: center; margin-bottom: 1.5rem;"><strong>{$t('verifyuser.dialog_password_success.message')}</strong></p>
    
    {#if passwordSuccessData.userPrincipalName}
      <div class="credentials-box">
        <p class="credential-label">{$t('verifyuser.dialog_password_success.username_label')}</p>
        <p class="credential-value">{passwordSuccessData.userPrincipalName}</p>
        <p class="credential-label">{$t('verifyuser.dialog_password_success.password_label')}</p>
        <p class="credential-value">{$t('verifyuser.dialog_password_success.password_hint')}</p>
      </div>
    {/if}
    
    <div class="info-box-success">
      <p style="margin: 0; text-align: center;">{$t('verifyuser.dialog_password_success.next_step_short')}</p>
    </div>
    
    <p style="text-align: center; font-style: italic; margin-top: 1rem; font-size: 0.9rem;">
      {#if countdown > 0}
        {$t('verifyuser.dialog_password_success.auto_redirect').replace('{seconds}', countdown)}
      {:else}
        {$t('verifyuser.dialog_password_success.click_to_continue')}
      {/if}
    </p>
  </ConfirmDialog>
{/if}

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
  
  .loading { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 0; }
  .loadingMessage { font-size:1rem; }
  .error-section { max-width:600px; margin:0 auto; }
  input[type="tel"]:focus { outline:2px solid var(--vann-60,#0066aa); outline-offset:2px; }
  .err-ribbon { display:flex; gap:10px; align-items:flex-start; background:#FDECEC; border:1px solid #F5B5B5; border-radius:6px; padding:10px; margin-bottom:8px; }
  .err-text { margin:0; font-weight:600; color:#B42318; }
  .err-ref { margin:4px 0 0; color:#7A271A; font-size:0.9rem; }
  .err-actions { display:flex; gap:6px; margin-left:auto; }
  
  /* Password dialog styles */
  .password-dialog-content { 
    max-width: 100%;
  }
  .info-box-password { 
    background: #e8f5e9; 
    padding: 0.75rem; 
    border-radius: 4px; 
    margin-bottom: 1rem;
    border: 2px solid #4caf50;
  }
  .info-box-password p { margin: 0.3rem 0; color: #333; line-height: 1.4; font-size: 0.9rem; }
  .phone-number { font-weight: 600; font-size: 1rem; color: #2e7d32; }
  .mock-password-box { 
    margin-top: 0.75rem; 
    padding: 0.75rem; 
    background: #fff3cd; 
    border: 2px dashed #ff9800; 
    border-radius: 4px; 
  }
  .mock-label { font-size: 0.85rem; color: #856404; margin-bottom: 0.25rem !important; font-weight: 600; }
  .mock-password { 
    font-size: 1.3rem; 
    font-weight: 700; 
    color: #d84315; 
    font-family: 'Courier New', monospace; 
    letter-spacing: 1px; 
    margin: 0.25rem 0 !important; 
  }
  .mock-hint { font-size: 0.8rem; color: #856404; font-style: italic; margin-top: 0.25rem !important; }
  
  /* Success dialog styles */
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
  }
  .info-box-success {
    background: #e3f2fd;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
    border-left: 4px solid #1976d2;
  }
  .info-box-success p { margin: 0.5rem 0; color: #333; line-height: 1.6; }
  .credentials-box {
    background: #f9f9f9;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
    border: 2px solid #ddd;
  }
  .credential-label {
    font-weight: 600;
    color: #555;
    margin: 0.5rem 0 0.25rem 0;
    font-size: 0.9rem;
  }
  .credential-value {
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    color: #1976d2;
    margin: 0 0 1rem 0;
    font-weight: 600;
  }
</style>