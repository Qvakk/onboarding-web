<script>
  import CardButton from '../lib/components/CardButton.svelte'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { t, locale } from 'svelte-i18n';
  import { derived } from 'svelte/store';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.home.title')) {
    document.title = `${$t('page.home.title')} | Brukerkonto`;
  }

  // Removed unused exported params; not required

  const schoolIcon = getThemeAsset('images/school.svg')
  const personIcon = getThemeAsset('images/person.svg')

  onMount(() => {
    const disableElev = import.meta.env.VITE_DISABLE_ELEV === 'true'
    if (disableElev) {
      goto('/ansatt')
    }
  })

  // This derived store will re-evaluate when the locale changes
  const cardElevHeader = derived(t, $t => $t('card.elev.header'));
  const cardElevImgAlt = derived(t, $t => $t('card.elev.imgAlt'));
  const cardElevParagraph = derived(t, $t => $t('card.elev.paragraph'));
  const cardAnsattHeader = derived(t, $t => $t('card.ansatt.header'));
  const cardAnsattImgAlt = derived(t, $t => $t('card.ansatt.imgAlt'));
  const cardAnsattParagraph = derived(t, $t => $t('card.ansatt.paragraph'));
</script>

<svelte:head>
</svelte:head>

<main>
  <h1 class="visually-hidden">{$t('page.home.heading')}</h1>
  <div class="centerstuff">
    <CardButton 
      header={$cardElevHeader}
      imgPath={schoolIcon}
      imgAlt={$cardElevImgAlt}
      gotoPath="/elev"
      paragraph={$cardElevParagraph}
      boolValue={true}
      func={() => {}} 
    />
    <CardButton 
      header={$cardAnsattHeader}  
      imgPath={personIcon}
      imgAlt={$cardAnsattImgAlt}
      gotoPath="/ansatt"
      paragraph={$cardAnsattParagraph}
      boolValue={true}
      func={() => {}}
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