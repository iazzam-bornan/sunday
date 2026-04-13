# Sunday Desktop

Electron shell for the Sunday Monday board app.

## Development

Start the web app yourself, then launch Electron:

```bash
bun --cwd apps/desktop run dev
```

Electron loads `http://localhost:3000` by default. Set `SUNDAY_WEB_URL` if the web app is running somewhere else.

## Tokens

Sunday reads `MONDAY_API_TOKEN` from the process environment. If no environment token exists, the app shows a local API-token screen and stores the override on the device through the existing Sunday settings.

## Packaging

```bash
bun --cwd apps/desktop run dist
```

The desktop package builds `apps/web` first and bundles its `.output` folder as an Electron resource.
