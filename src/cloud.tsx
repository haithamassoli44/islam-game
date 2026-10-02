import React from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import App from './App';

function useCloud() {
  const auth = useConvexAuth();
  const authActions = useAuthActions();
  const home = useQuery(api.game.list, auth.isAuthenticated ? {} : 'skip');
  return { ...auth, ...authActions, home, unlock: useAction(api.parents.unlock), lock: useMutation(api.parents.lock),
    create: useMutation(api.game.create), apply: useMutation(api.game.apply),
    updateSettings: useMutation(api.game.updateSettings), confirm: useMutation(api.game.confirm), remove: useMutation(api.game.remove) };
}
export type Cloud = ReturnType<typeof useCloud>;
export function ConnectedApp() { const cloud = useCloud(); return <App cloud={cloud} />; }
