<script>
  import CardButton from '$lib/components/CardButton.svelte'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  const schoolIcon = getThemeAsset('images/school.svg')
  const personIcon = getThemeAsset('images/person.svg')

  onMount(() => {
    const disableElev = import.meta.env.VITE_DISABLE_ELEV === 'true'
    if (disableElev) {
      goto('/ansatt')
    }
  })
</script>
  
  <main>
    <div class="centerstuff">
      <CardButton 
        header="Elev eller lærling"
        imgPath={schoolIcon}
        imgAlt="Ikon bilde av en elev"
        gotoPath="/elev"
        paragraph="Trykk her hvis du er elev eller lærling"
        boolValue={true}
        func={() => {}} 
      />
      <CardButton 
        header="Ansatt"  
        imgPath={personIcon}
        imgAlt="Ikon bilde av en ansatt"
        gotoPath="/ansatt"
        paragraph="Trykk her hvis du er ansatt"
        boolValue={true}
        func={() => {}}
      />
    </div>
  </main>