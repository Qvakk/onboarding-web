# Onboarding Web

SvelteKit frontend for user verification and onboarding with ID-porten and Entra ID.

## Stack
- **Framework**: SvelteKit + Vite
- **Runtime**: Node.js (Azure Web App)
- **Auth**: ID-porten → Backend API → Entra ID
- **i18n**: Norwegian Bokmål, Nynorsk, English, Sami

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page (student/employee choice) |
| `/elev` | Student verification flow |
| `/ansatt` | Employee verification flow |
| `/idportencallback` | ID-porten callback handler |
| `/verifyuser` | User verification + phone confirmation |
| `/validationcallback` | Entra ID validation callback |
| `/success` | Success page with redirect |
| `/admin` | Admin login |
| `/stats` | Statistics dashboard |

## User Flow

```
Landing → ID-porten → VerifyUser → Phone Confirmation
                                         ↓
                  CloudFlow (generate password + SMS)
                                         ↓
                   Entra Validation (MFA) → Success
```

## Configuration

`.env`:

```bash
VITE_THEME_NAME="frid"
VITE_DEFAULT_LANGUAGE="browser"
VITE_ONBOARDING_API_URI="http://localhost:7071/api"
VITE_ONBOARDING_API_PUBLIC_KEY="your-key"
VITE_SERVICEDESK_TLF="33 44 55 66"
VITE_SERVICEDESK_EPOST="servicedesk@fylke.no"
VITE_DISABLE_ELEV="false"
VITE_SUCCESS_REDIRECT_ANSATT_URL="https://portal.domain.com"
VITE_SUCCESS_REDIRECT_ELEV_URL="https://student.domain.com"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_THEME_NAME` | Theme folder name in `/static/themes/` |
| `VITE_DEFAULT_LANGUAGE` | `browser`, `nb`, `nn`, `en`, or `se` |
| `VITE_ONBOARDING_API_URI` | Backend API base URL |
| `VITE_ONBOARDING_API_PUBLIC_KEY` | API function key |
| `VITE_SERVICEDESK_TLF` | Helpdesk phone number |
| `VITE_SERVICEDESK_EPOST` | Helpdesk email |
| `VITE_DISABLE_ELEV` | `true` to hide student button |
| `VITE_SUCCESS_REDIRECT_ANSATT_URL` | Redirect URL for employees |
| `VITE_SUCCESS_REDIRECT_ELEV_URL` | Redirect URL for students |

## Development

```bash
npm install
cp .env.example .env
# Configure .env
npm run dev
```

## Build & Deploy

### Azure Web App (Node.js)

```bash
# Build
npm run build

# Add package.json to build folder
echo '{ "type": "module" }' > build/package.json

# Deploy build folder to Azure Web App
```

### Adapter Configuration

Use `@sveltejs/adapter-node` in `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-node'
```

## Theming

1. Create theme folder in `/static/themes/<theme-name>/`
2. Set `VITE_THEME_NAME="<theme-name>"`
3. Include:
   - `logo.svg`
   - `styles.css`
   - `favicon.ico`
