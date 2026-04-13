# Sunday

Sunday is a cleaner Monday board client with a Kanban-first workflow, persistent filters, editable ticket details, comments/media support, and a Windows Electron app.

## Apps

- `apps/web`: TanStack Start web app.
- `apps/desktop`: Electron desktop shell for the web app.
- `packages/ui`: shared shadcn-style UI components.

## Development

Install dependencies:

```bash
bun install
```

Run the web app:

```bash
cd apps/web
bun run dev
```

Run Electron against the web dev server:

```bash
cd apps/desktop
bun run dev
```

Electron loads `http://localhost:3000` by default. Set `SUNDAY_WEB_URL` if the web app runs elsewhere.

## Monday Token

Sunday reads `MONDAY_API_TOKEN` from the process environment. If it is not set, the app shows a first-run API token screen and stores the token locally.

Optional environment values:

```bash
MONDAY_API_TOKEN=
MONDAY_DEFAULT_BOARD_ID=
MONDAY_STATUS_COLUMN_ID=
```

## Release

Build a local Windows release:

```bash
cd apps/desktop
bun run dist
```

Publish an auto-update release by pushing a version tag:

```bash
git tag v0.0.2
git push origin v0.0.2
```

The GitHub Actions release workflow builds the Windows installer and publishes it to GitHub Releases. Packaged Electron builds check GitHub Releases for updates.
