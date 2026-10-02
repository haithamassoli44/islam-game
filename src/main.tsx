import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import App from './App';
import { ConnectedApp } from './cloud';
import './styles.css';

const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;
createRoot(document.getElementById('root')!).render(client
  ? <ConvexAuthProvider client={client}><ConnectedApp /></ConvexAuthProvider> : <App />);
