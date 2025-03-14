<script>
  import { getIdPortenLoginUrl } from '../../lib/useApi'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import CardButton from '../../lib/components/CardButton.svelte'

  const keyIcon = getThemeAsset('images/key.svg')
  const verifiedIcon = getThemeAsset('images/verified.svg')

  let errorMessage = null
  let loading = false
  let entraPwdReset = import.meta.env.VITE_PWD_RESET_REDIRECT === 'true'
  let pwdResetUrl = import.meta.env.VITE_PWD_RESET_URL
  let disablePwdReset = import.meta.env.VITE_DISABLE_PWD_RESET === 'true'

  const redirect = async (action) => {
    errorMessage = null
    try {
      loading = action
      if (entraPwdReset && action === 'resetpassword') {
        window.location.href = pwdResetUrl
        return
      }
      const { loginUrl } = await getIdPortenLoginUrl('ansatt', action)
      loading = false
      window.location.href = loginUrl
    } catch (error) {
      loading = false
      errorMessage = error.response?.data?.message || error.toString()
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
      imgAlt="Ikon bilde av verifisert"
      gotoPath=""
      paragraph="Krever pålogging med MinID eller BankID"
      boolValue={false}
      loading={loading === 'verifyuser'}
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
        loading={loading === 'resetpassword'}
        func={() => redirect('resetpassword')}
      />
    {/if}
  </div>
</main>