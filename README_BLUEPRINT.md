# Foundry Demo Blueprint Starter Kit

This directory contains the core framework used for the **Eli Lilly Medicine Foundry** demos. You can use this as a template to build any new process vertical in minutes.

## Directory Structure

- `interaction-server.cjs`: The Node.js backend. Handles polling, resets, and Chatbot API.
- `src/components`: UI components (Process List, Details, Chat, etc.).
- `public/data`: Deployment data (initial JSON stories and case registry).
- `simulation_scripts/`: Folder to store your real-time simulation `.cjs` scripts.

## How to Create a New Vertical

1.  **Define the Metadata**: Update `public/data/processes.json` with your new case IDs and categories.
2.  **Write the Story**: Create a `process_[ID].json` in `public/data/` for each case. Aim for 15+ steps with reasoning and artifacts.
3.  **Active Simulation**: Create a script in `simulation_scripts/` for each case. Use the `happy_path.cjs` pattern to drip-feed updates to the interaction server.
4.  **Tailor the UI**: Update the category-specific conditionals in `src/components/ProcessList.jsx` and `src/components/ProcessDetails.jsx` to show your relevant fields (e.g., "Delivery Status", "Quality Score").

## Deployment Configuration

### Railway (Backend)
- **Root Directory**: `[your-new-app-folder]`
- **Start Command**: `node interaction-server.cjs`
- **Port**: 3001 (or as configured)
- **Variables**: `GEMINI_API_KEY`, `VITE_MODEL`

### Vercel (Frontend)
- **Root Directory**: `[your-new-app-folder]`
- **Framework**: Vite
- **Variables**: `VITE_API_URL` (pointing to your Railway URL)

---
*Created by Antigravity*
