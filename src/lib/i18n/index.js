import { register, init, getLocaleFromNavigator, locale } from 'svelte-i18n';

register('nb', () => import('./nb.json'));
register('nn', () => import('./nn.json'));
register('en', () => import('./en.json'));
register('se', () => import('./se.json'));

// Get environment-based default language, fallback to browser detection
function getDefaultLanguage() {
  const envDefault = import.meta.env.VITE_DEFAULT_LANGUAGE;
  const supportedLanguages = ['nb', 'nn', 'en', 'se'];
  
  // If environment specifies a valid language, use it
  if (envDefault && supportedLanguages.includes(envDefault)) {
    console.log(`🌍 Language: Using environment setting "${envDefault}"`);
    return envDefault;
  }
  
  // If environment says 'browser' or is not set, use browser detection
  if (!envDefault || envDefault === 'browser') {
    const browserLocale = getLocaleFromNavigator();
    if (!browserLocale) {
      console.log('🌍 Language: No browser locale detected, defaulting to Norwegian Bokmål');
      return 'nb';
    }
    const short = browserLocale.split('-')[0];
    if (supportedLanguages.includes(short)) {
      console.log(`🌍 Language: Using browser detection "${short}" (from "${browserLocale}")`);
      return short;
    }
    console.log(`🌍 Language: Browser locale "${browserLocale}" not supported, defaulting to Norwegian Bokmål`);
  }
  
  // Always default to Norwegian Bokmål for unsupported locales
  console.log('🌍 Language: Defaulting to Norwegian Bokmål');
  return 'nb';
}

const savedLocale = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('locale');
// Priority: 1. Saved locale, 2. Environment default, 3. Browser detection, 4. Norwegian Bokmål
let initialLocale;
if (savedLocale && ['nb', 'nn', 'en', 'se'].includes(savedLocale)) {
  console.log(`🌍 Language: Using saved preference "${savedLocale}"`);
  initialLocale = savedLocale;
} else {
  initialLocale = getDefaultLanguage();
}

init({
  fallbackLocale: 'nb', // Norwegian Bokmål as fallback
  initialLocale: initialLocale || 'nb', // Ensure we always have a locale
});

// Set Norwegian Bokmål as default if no valid locale is determined
locale.set(initialLocale || 'nb');

if (typeof window !== 'undefined') {
  locale.subscribe((value) => {
    // Only save valid locales, default to Norwegian Bokmål
    const validValue = value && ['nb', 'nn', 'en', 'se'].includes(value) ? value : 'nb';
    sessionStorage.setItem('locale', validValue);
  });
}

export { locale };
