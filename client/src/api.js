const API = import.meta.env.VITE_API_URL || '';

const getToken = () => localStorage.getItem('rx_token');

export const apiFetch = (path, options = {}) => {
  const token = getToken();
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};
