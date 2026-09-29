import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useEventConfig } from '../lib/eventConfig';
import { formatInviter, formatPhone } from '../lib/format';
import logo from '../assets/image.png';
import {
  login,
  logout,
  checkAuth,
  getDashboard,
  deleteRegistration,
  exportUrl,
  streamUrl,
  getToken,
  setToken,
} from '../lib/api';

const DEFAULT_FILTERS = {
  q: '',
  invitePar: '',
  pointRamassage: '',
  structureMedicale: '',
  presence: '',
  sort: 'createdAtDesc',
};

const POLL_INTERVAL = 20000;

function buildQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function Admin() {
  const { event } = useEventConfig();
  const [auth, setAuth] = useState(getToken() ? 'checking' : 'anon');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState({
    items: [],
    total: 0,
    filteredCount: 0,
    valeurs: { invitePar: [], pointRamassage: [], structures: [], presence: [] },
    repartition: { parInvite: [], parPoint: [], parPresence: [] },
    dernieresInscription: null,
  });
  const [loadError, setLoadError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [live, setLive] = useState('off');
  const [newIds, setNewIds] = useState(() => new Set());
  const [notice, setNotice] = useState('');
  const sourceRef = useRef(null);
  const requestCounter = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  /* ------------------------- Authentification ------------------------- */

  useEffect(() => {
    if (!getToken()) {
      setAuth('anon');
      return undefined;
    }
    const controller = new AbortController();
    checkAuth(controller.signal)
      .then(() => setAuth('authed'))
      .catch(() => setAuth('anon'));
    return () => controller.abort();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (!password) {
      setAuthError('Veuillez saisir le mot de passe.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const res = await login(password);
      if (res?.data?.token) setToken(res.data.token);
      setAuth('authed');
      setPassword('');
    } catch (err) {
      setAuthError(err.message || 'Connexion impossible.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setToken('');
    if (sourceRef.current) sourceRef.current.close();
    setAuth('anon');
  }

  /* ------------------------ Chargement des données ---------------------- */

  const load = useCallback(async (query, { markNew = [] } = {}) => {
    const requestId = ++requestCounter.current;
    try {
      const res = await getDashboard(query);
      if (requestId !== requestCounter.current) return; // reponse obsolete
      if (res?.ok) {
        setData(res.data);
        setLoadError('');
        setLastUpdate(new Date());
        if (markNew.length) {
          setNewIds(new Set(markNew));
          window.setTimeout(() => setNewIds(new Set()), 2000);
        }
      }
    } catch (err) {
      if (requestId !== requestCounter.current) return;
      if (err.status === 401) {
        setToken('');
        setAuth('anon');
        return;
      }
      setLoadError(err.message || 'Chargement impossible.');
    }
  }, []);

  // Recherche differee
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((prev) => (prev.q === searchInput ? prev : { ...prev, q: searchInput }));
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Rechargement a chaque changement de filtre
  useEffect(() => {
    if (auth !== 'authed') return undefined;
    load(buildQuery(filters));
  }, [filters, auth, load]);

  /* ------------------------- Temps réel (SSE) -------------------------- */

  useEffect(() => {
    if (auth !== 'authed') return undefined;

    let source;
    let pollId = null;
    let debounceId = null;
    let disposed = false;

    const refreshSoon = (markNew = []) => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        if (!disposed) load(buildQuery(filtersRef.current), { markNew });
      }, 350);
    };

    const startPolling = () => {
      if (pollId) return;
      pollId = window.setInterval(() => {
        if (document.visibilityState === 'visible') refreshSoon();
      }, POLL_INTERVAL);
    };

    try {
      source = new EventSource(streamUrl(), { withCredentials: true });
      sourceRef.current = source;

      source.addEventListener('open', () => setLive('on'));
      source.addEventListener('connected', () => setLive('on'));
      source.addEventListener('registration', (evt) => {
        let payload = {};
        try {
          payload = JSON.parse(evt.data);
        } catch (err) {
          payload = {};
        }
        setLive('on');
        setNotice(
          `Nouvelle inscription : ${payload?.registration?.prenom || ''} ${
            payload?.registration?.nom || ''
          }`.trim()
        );
        window.setTimeout(() => setNotice(''), 6000);
        refreshSoon(payload?.registration?.id ? [payload.registration.id] : []);
      });
      source.addEventListener('deletion', () => refreshSoon());
      source.addEventListener('error', () => {
        setLive('off');
        startPolling();
      });
    } catch (err) {
      setLive('off');
      startPolling();
    }

    return () => {
      disposed = true;
      window.clearTimeout(debounceId);
      window.clearInterval(pollId);
      if (source) source.close();
      sourceRef.current = null;
    };
  }, [auth, load]);

  /* ------------------------------ Actions ------------------------------ */

  async function handleDelete(item) {
    const ok = window.confirm(
      `Supprimer l'inscription de ${item.prenom} ${item.nom} (${item.numeroInscription}) ?`
    );
    if (!ok) return;
    try {
      await deleteRegistration(item.id || item._id);
      await load(buildQuery(filters));
    } catch (err) {
      setLoadError(err.message || 'Suppression impossible.');
    }
  }

  function handleExport(format) {
    const url = exportUrl(format, buildQuery(filters));
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function resetFilters() {
    setSearchInput('');
    setFilters(DEFAULT_FILTERS);
  }

  const hasFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => key !== 'sort' && value),
    [filters]
  );

  /* ------------------------------ Rendu -------------------------------- */

  if (auth === 'checking') {
    return (
      <Layout>
        <div className="container">
          <div className="empty">
            <strong>Vérification de la session…</strong>
          </div>
        </div>
      </Layout>
    );
  }

  if (auth === 'anon') {
    return (
      <Layout>
        <div className="container login-wrap">
          <div className="card">
            <h1 className="card-title">Espace administrateur</h1>
            <p className="card-subtitle">
              {event.title} — {event.dateLabel}
            </p>
            {authError && (
              <div className="alert alert-error" role="alert">
                {authError}
              </div>
            )}
            <form onSubmit={handleLogin} noValidate>
              <div className="field">
                <label htmlFor="password">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthError('');
                  }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={authBusy}>
                {authBusy ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
            <p className="small muted mt-16 text-center">
              <Link to="/">← Retour au formulaire d'inscription</Link>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const { items, total, filteredCount, valeurs, repartition } = data;
  const confirmes = (repartition.parPresence || []).find((r) => r.value === 'Oui');

  return (
    <div className="page">
      <header className="site-header">
        <div className="container">
          <Link className="brand" to="/">
            <img className="brand-logo" src={logo} alt="EXPHA" />
            <span className="brand-suffix">Admin</span>
          </Link>
          <div className="header-meta">
            <span className="hide-sm">{event.dateLabel}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="admin-bar">
        <div className="container">
          <div>
            <span className={`live ${live}`}>
              <span className="dot" />
              {live === 'on' ? 'Mise à jour en temps réel' : 'Actualisation automatique (20 s)'}
            </span>
            {lastUpdate && (
              <span className="small muted" style={{ marginLeft: 10 }}>
                Dernière mise à jour : {lastUpdate.toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => load(buildQuery(filters))}
            >
              ⟳ Actualiser
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('csv')}
            >
              ⬇ Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('xls')}
            >
              ⬇ Export Excel
            </button>
          </div>
        </div>
      </div>

      <main className="site-main">
        <div className="container section">
          {notice && (
            <div className="alert alert-success" role="status">
              {notice}
            </div>
          )}
          {loadError && (
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          )}

          <div className="stat-grid">
            <div className="stat">
              <div className="label">Total inscrits</div>
              <div className="value">{total}</div>
            </div>
            <div className="stat">
              <div className="label">Résultats affichés</div>
              <div className="value">{filteredCount}</div>
            </div>
            <div className="stat">
              <div className="label">Invités par</div>
              <div className="value">{repartition.parInvite.length}</div>
            </div>
            <div className="stat">
              <div className="label">Présences confirmées</div>
              <div className="value">
                {confirmes ? `${confirmes.count}/${total}` : '—'}
              </div>
            </div>
            <div className="stat">
              <div className="label">Structures</div>
              <div className="value">{valeurs.structures.length}</div>
            </div>
            <div className="stat">
              <div className="label">Dernière inscription</div>
              <div className="value small">
                {data.dernieresInscription
                  ? `${data.dernieresInscription.prenom} ${data.dernieresInscription.nom}`
                  : '—'}
              </div>
            </div>
          </div>

          <div className="toolbar">
            <div className="field">
              <label htmlFor="q">Recherche (nom, prénom, téléphone)</label>
              <input
                id="q"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ex : Diop ou 77 123 45 67"
              />
            </div>
            <div className="field">
              <label htmlFor="f-invite">Filtre : invité(e) par</label>
              <select
                id="f-invite"
                value={filters.invitePar}
                onChange={(e) => setFilters((p) => ({ ...p, invitePar: e.target.value }))}
              >
                <option value="">Tous</option>
                {(valeurs.invitePar || []).map((v) => (
                  <option key={v} value={v}>
                    {formatInviter(v)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-point">Filtre : point de ramassage</label>
              <select
                id="f-point"
                value={filters.pointRamassage}
                onChange={(e) => setFilters((p) => ({ ...p, pointRamassage: e.target.value }))}
              >
                <option value="">Tous</option>
                {(valeurs.pointRamassage || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-structure">Filtre : structure médicale</label>
              <select
                id="f-structure"
                value={filters.structureMedicale}
                onChange={(e) => setFilters((p) => ({ ...p, structureMedicale: e.target.value }))}
              >
                <option value="">Toutes</option>
                {(valeurs.structures || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-presence">Filtre : présence</label>
              <select
                id="f-presence"
                value={filters.presence}
                onChange={(e) => setFilters((p) => ({ ...p, presence: e.target.value }))}
              >
                <option value="">Tous</option>
                {(valeurs.presence || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-sort">Trier par</label>
              <select
                id="f-sort"
                value={filters.sort}
                onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}
              >
                <option value="createdAtDesc">Inscription (récent)</option>
                <option value="createdAt">Inscription (ancien)</option>
                <option value="nom">Nom (A → Z)</option>
                <option value="nomDesc">Nom (Z → A)</option>
                <option value="numeroInscription">N° inscription</option>
              </select>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetFilters}
                disabled={!hasFilters}
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">N°</th>
                    <th scope="col">Nom</th>
                    <th scope="col">Prénom</th>
                    <th scope="col">Téléphone</th>
                    <th scope="col">Structure médicale</th>
                    <th scope="col">Invité(e) par</th>
                    <th scope="col">Point de ramassage</th>
                    <th scope="col">Présence</th>
                    <th scope="col">Date d'inscription</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="empty">
                          <strong>Aucune inscription à afficher</strong>
                          {hasFilters
                            ? 'Aucun résultat pour ces filtres.'
                            : 'Les inscriptions apparaîtront ici en temps réel.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr
                        key={item.id || item._id || item.numeroInscription}
                        className={newIds.has(item.id || item._id) ? 'is-new' : ''}
                      >
                        <td className="cell-num">{index + 1}</td>
                        <td>
                          <strong>{item.nom}</strong>
                        </td>
                        <td>{item.prenom}</td>
                        <td className="tel">{formatPhone(item.telephone)}</td>
                        <td>{item.structureMedicale}</td>
                        <td>{formatInviter(item.invitePar)}</td>
                        <td>{item.pointRamassage}</td>
                        <td>
                          <span
                            className={`tag ${item.presence === 'Non' ? 'tag-no' : 'tag-yes'}`}
                          >
                            {item.presence || 'Oui'}
                          </span>
                        </td>
                        <td className="small muted">{formatDateTime(item.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(item)}
                            title="Supprimer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="footer-note">
            Export CSV / Excel : les filtres actifs sont pris en compte.
          </p>
        </div>
      </main>
    </div>
  );
}
