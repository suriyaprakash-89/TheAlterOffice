const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function apiPath(path) {
  return `${API_BASE}${path}`;
}

export async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(apiPath(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

export function buildShareUrl(sharePath) {
  if (!sharePath) return '';
  return `${window.location.origin}${sharePath}`;
}
