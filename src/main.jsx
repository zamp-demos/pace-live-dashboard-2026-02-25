import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-reload on chunk load failure (e.g. after a new Vercel deployment
// invalidates old code-split chunks that the browser cached).
// Uses sessionStorage to avoid infinite reload loops.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'chunkErrorReload';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }
});

// Clear the reload guard on successful load so future errors still trigger a retry.
window.addEventListener('load', () => {
  sessionStorage.removeItem('chunkErrorReload');
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
