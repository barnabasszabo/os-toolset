# Windows Widget - Electron App

Always-on-top widget alkalmazás Windows 11-re Microsoft Entra autentikációval.

## Telepítés

```bash
npm install --save
```

## Függőségek telepítése

Minden új package telepítésekor használd a `--save` flag-et:

```bash
# Production dependency
npm install <package-name> --save

# Development dependency
npm install <package-name> --save-dev
```

## Futtatás

```bash
npm start
```

## Funkciók

- Always-on-top, frameless ablak
- Mozgatható pozíció
- Expand/collapse funkcionalitás
- Microsoft Entra (Azure AD) autentikáció
- Microsoft Graph API integráció

## Konfiguráció

Az autentikáció konfigurációja a `msal-config.js` fájlban található.
