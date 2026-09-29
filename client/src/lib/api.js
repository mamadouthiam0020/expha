const TOKEN_KEY = 'expha_admin_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (err) {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || {};
  }
}

async function request(path, { method = 'GET', body, auth = false, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Connexion au serveur impossible. Verifiez votre reseau.', 0, {});
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    if (response.status === 401 && auth) setToken('');
    throw new ApiError(
      payload.message || 'Une erreur est survenue.',
      response.status,
      payload.errors || {}
    );
  }
  return payload;
}

/* --------------------------- Public --------------------------- */

export function postRegistration(data) {
  return request('/api/registrations', { method: 'POST', body: data });
}

export function getEventConfig(signal) {
  return request('/api/event', { signal });
}

export function getPublicStats(signal) {
  return request('/api/registrations/stats', { signal });
}

/* ---------------------------- Admin --------------------------- */

export function login(password) {
  return request('/api/admin/login', { method: 'POST', body: { password } });
}

export function logout() {
  return request('/api/admin/logout', { method: 'POST' }).catch(() => ({}));
}

export function checkAuth(signal) {
  return request('/api/admin/me', { auth: true, signal });
}

export function getDashboard(query, signal) {
  return request(`/api/registrations/dashboard?${query.toString()}`, { auth: true, signal });
}

export function deleteRegistration(id) {
  return request(`/api/registrations/${id}`, { method: 'DELETE', auth: true });
}

export function streamUrl() {
  const token = getToken();
  return token ? `/api/admin/stream?token=${encodeURIComponent(token)}` : '/api/admin/stream';
}

export function exportUrl(format, query) {
  const params = new URLSearchParams(query);
  const token = getToken();
  if (token) params.set('token', token);
  return `/api/registrations/export.${format}?${params.toString()}`;
}
