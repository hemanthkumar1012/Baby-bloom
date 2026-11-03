import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('bb_token')) return setReady(true);
    api('/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('bb_token'))
      .finally(() => setReady(true));
  }, []);

  const save = ({ token, user }) => {
    localStorage.setItem('bb_token', token);
    setUser(user);
    return user;
  };

  const value = {
    user,
    ready,
    login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password }, auth: false }).then(save),
    register: (form) => api('/auth/register', { method: 'POST', body: form, auth: false }).then(save),
    logout: () => {
      localStorage.removeItem('bb_token');
      setUser(null);
    },
    setUser,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
