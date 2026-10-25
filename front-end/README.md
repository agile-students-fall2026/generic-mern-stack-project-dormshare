# DormShare Front-End

React front-end for DormShare, built with [Vite](https://vite.dev/). It currently runs on mock data; the Express back-end is integrated in Sprint 2.

## Prerequisites

- Node.js v20.19 or newer (check with `node -v`)
- npm

## Setup and run

```bash
cd front-end
npm install
npm run dev
```

Open <http://localhost:5173>. A page reading "Front-end health check: OK" means you good.

## Scripts

| Command           | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Start the dev server with hot reloading |
| `npm run build`   | Create a production build in `dist/`    |
| `npm run preview` | Serve the production build locally      |
| `npm run lint`    | Check the code with ESLint              |

## Structure

```text
front-end/
├── public/          
├── src/
│   ├── components/  # reusable UI pieces
│   ├── pages/       # one component per screen
│   ├── assets/      # images and other files
│   ├── App.jsx      # root component
│   ├── main.jsx     # entry point
│   └── index.css    # global styles - we could use tailwind
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

