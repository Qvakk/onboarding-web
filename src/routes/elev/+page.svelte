<script>
  import { getIdPortenLoginUrl } from '../../lib/useApi'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import CardButton from '../../lib/components/CardButton.svelte'

  const keyIcon = getThemeAsset('images/key.svg')
  const verifiedIcon = getThemeAsset('images/verified.svg')

  let errorMessage = null
  let loadingAction = null // Changed from loading = false
  let disablePwdReset = import.meta.env.VITE_DISABLE_PWD_RESET === 'true'
  let entraPwdReset = import.meta.env.VITE_PWD_RESET_REDIRECT === 'true'
  let pwdResetUrl = import.meta.env.VITE_PWD_RESET_URL

  const redirect = async (action) => {
    const confirmation = true
    errorMessage = null
    if (confirmation) {
      try {
        loadingAction = action // Set which action is loading
        if (entraPwdReset && action === 'resetpassword') {
          window.location.href = pwdResetUrl
          return
        }
        const { loginUrl } = await getIdPortenLoginUrl('elev', action)
        window.location.href = loginUrl
      } catch (error) {
        loadingAction = null // Reset loading state
        errorMessage = error.response?.data?.message || error.toString()
      }
    }
  }
</script>

<main>
  {#if errorMessage}
    <div class="error">
      <h3 class="errorTitle">Oi, noe gikk galt 😩</h3>
      <p>{errorMessage}</p>
    </div>
  {/if}
  <div class="centerstuff">
    <CardButton 
      header="Verifiser bruker"
      imgPath={verifiedIcon}
      imgAlt="Ikon bilde av verifisert "
      gotoPath=""
      paragraph="Krever pålogging med MinID eller BankID"
      boolValue={false}
      loading={loadingAction === 'verifyuser'}
      func={() => redirect('verifyuser')}
    />

    {#if !disablePwdReset}
      <CardButton 
        header="Tilbakestill passord"
        imgPath={keyIcon}
        imgAlt="Ikon bilde av en nøkkel"
        gotoPath=""
        paragraph="Videresender deg til Microsoft - Min-Konto for å resette passord"
        boolValue={false}
        loading={loadingAction === 'resetpassword'}
        func={() => redirect('resetpassword')}
      />
    {/if}
  </div>
</main>