# CoalGuard — Integrated Full-Stack Prototype

CoalGuard is now packaged as one project containing the React/Vite frontend and the Express/SQLite backend.

## Run everything

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

- Frontend: Vite + React + TypeScript
- Backend: Express
- Database: SQLite via better-sqlite3
- API: `/api/health`, `/api/auth`, `/api/inspections`, `/api/locations`
- Vite proxies `/api` requests to the backend on port 3000.

## Production

```bash
npm install
npm run build
npm start
```

The Express server serves the built React application and the API from the same server.

## Prototype demo account

The database initializer creates a demo inspector record:

- Email: `inspector@coalguard.local`
- Password: `demo-password`

This is only for the prototype and should be replaced before deployment.
