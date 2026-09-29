import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useEventConfig } from '../lib/eventConfig';
import { postRegistration, getPublicStats } from '../lib/api';
import { validateRegistration, hasErrors, cleanText, formatPhoneInput } from '../lib/validation';

const EMPTY = {
  nom: '',
  prenom: '',
  telephone: '',
  structureMedicale: '',
  invitePar: '',
  pointRamassage: '',
};

export default function Home() {
  const { event, invitePar, pointRamassage } = useEventConfig();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [stats, setStats] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    getPublicStats(controller.signal)
      .then((res) => {
        if (res?.ok) setStats(res.data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [confirmation]);

  function handleChange(field) {
    return (e) => {
      const raw = e.target.value;
      const value = field === 'telephone' ? formatPhoneInput(raw) : raw;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setGlobalError('');
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const found = validateRegistration(values, { invitePar, pointRamassage });
    setErrors(found);
    if (hasErrors(found)) {
      const firstKey = Object.keys(found)[0];
      const el = formRef.current?.querySelector(`[name="${firstKey}"]`);
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return;
    }

    setSubmitting(true);
    setGlobalError('');
    try {
      const res = await postRegistration({
        nom: cleanText(values.nom),
        prenom: cleanText(values.prenom),
        telephone: cleanText(values.telephone),
        structureMedicale: cleanText(values.structureMedicale),
        invitePar: values.invitePar,
        pointRamassage: values.pointRamassage,
      });
      setConfirmation(res.data);
      setValues(EMPTY);
      setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length) setErrors(err.errors);
      setGlobalError(err.message || "Une erreur est survenue. Merci de réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setConfirmation(null);
    setGlobalError('');
  }

  return (
    <Layout>
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="hero">
        <div className="container">
          <span className="hero-badge">Inscription ouverte</span>
          <h1>{event.title}</h1>
          <div className="hero-date">{event.dateLabel}</div>
          <div className="hero-facts">
            <span className="hero-fact">📍 {event.location}</span>
            <span className="hero-fact">🏛️ Organisé par {event.organizer}</span>
            <span className="hero-fact">🎓 Avec le {event.speaker}</span>
          </div>
          {stats && (
            <div className="counter-strip">
              <span>
                {stats.total} inscrit{stats.total > 1 ? 's' : ''} à ce jour
              </span>
              {stats.derniere && (
                <span>
                  Dernière inscription : {stats.derniere.prenom} {stats.derniere.nom}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------- FORMULAIRE -------------------------- */}
      <div className="container form-wrap">
        {confirmation ? (
          <div className="section">
            <div className="card confirmation" role="status">
              <div className="check">✓</div>
              <h2>Votre inscription a bien été enregistrée.</h2>
              <p className="muted">Merci et à bientôt !</p>

              <div className="numero-box">{confirmation.numeroInscription}</div>
              <p className="small muted">Votre numéro d'inscription</p>

              <div className="recap">
                <div>
                  <span>Nom</span>
                  <span>{confirmation.nom}</span>
                </div>
                <div>
                  <span>Prénom</span>
                  <span>{confirmation.prenom}</span>
                </div>
                <div>
                  <span>Téléphone</span>
                  <span>{confirmation.telephone}</span>
                </div>
                <div>
                  <span>Invité(e) par</span>
                  <span>{confirmation.invitePar}</span>
                </div>
                <div>
                  <span>Point de ramassage</span>
                  <span>{confirmation.pointRamassage}</span>
                </div>
              </div>

              <button type="button" className="btn btn-primary btn-lg" onClick={reset}>
                Nouvelle inscription
              </button>
            </div>
          </div>
        ) : (
          <div className="section">
            <div className="card">
              <h2 className="card-title">Formulaire d'inscription</h2>
              <p className="card-subtitle">
                Tous les champs sont obligatoires. Votre inscription est enregistrée
                immédiatement.
              </p>

              {globalError && (
                <div className="alert alert-error" role="alert">
                  {globalError}
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label htmlFor="nom">
                    Nom<span className="required">*</span>
                  </label>
                  <input
                    id="nom"
                    name="nom"
                    type="text"
                    className={errors.nom ? 'invalid' : ''}
                    value={values.nom}
                    onChange={handleChange('nom')}
                    autoComplete="family-name"
                    placeholder="Ex : Diop"
                    aria-invalid={Boolean(errors.nom)}
                  />
                  {errors.nom && <span className="field-error">{errors.nom}</span>}
                </div>

                <div className="field">
                  <label htmlFor="prenom">
                    Prénom<span className="required">*</span>
                  </label>
                  <input
                    id="prenom"
                    name="prenom"
                    type="text"
                    className={errors.prenom ? 'invalid' : ''}
                    value={values.prenom}
                    onChange={handleChange('prenom')}
                    autoComplete="given-name"
                    placeholder="Ex : Awa"
                    aria-invalid={Boolean(errors.prenom)}
                  />
                  {errors.prenom && <span className="field-error">{errors.prenom}</span>}
                </div>

                <div className="field">
                  <label htmlFor="telephone">
                    Numéro de téléphone<span className="required">*</span>
                  </label>
                  <input
                    id="telephone"
                    name="telephone"
                    type="tel"
                    inputMode="tel"
                    className={errors.telephone ? 'invalid' : ''}
                    value={values.telephone}
                    onChange={handleChange('telephone')}
                    autoComplete="tel"
                    placeholder="77 123 45 67"
                    aria-invalid={Boolean(errors.telephone)}
                  />
                  {errors.telephone ? (
                    <span className="field-error">{errors.telephone}</span>
                  ) : (
                    <span className="hint">Format sénégalais (9 chiffres) ou +221...</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="structureMedicale">
                    Structure médicale<span className="required">*</span>
                  </label>
                  <input
                    id="structureMedicale"
                    name="structureMedicale"
                    type="text"
                    className={errors.structureMedicale ? 'invalid' : ''}
                    value={values.structureMedicale}
                    onChange={handleChange('structureMedicale')}
                    placeholder="Ex : Centre de santé de Somone"
                    aria-invalid={Boolean(errors.structureMedicale)}
                  />
                  {errors.structureMedicale && (
                    <span className="field-error">{errors.structureMedicale}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="invitePar">
                    Invité(e) par<span className="required">*</span>
                  </label>
                  <select
                    id="invitePar"
                    name="invitePar"
                    className={errors.invitePar ? 'invalid' : ''}
                    value={values.invitePar}
                    onChange={handleChange('invitePar')}
                    aria-invalid={Boolean(errors.invitePar)}
                  >
                    <option value="">— Choisir —</option>
                    {invitePar.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {errors.invitePar && <span className="field-error">{errors.invitePar}</span>}
                </div>

                <div className="field">
                  <label htmlFor="pointRamassage">
                    Point de ramassage<span className="required">*</span>
                  </label>
                  <select
                    id="pointRamassage"
                    name="pointRamassage"
                    className={errors.pointRamassage ? 'invalid' : ''}
                    value={values.pointRamassage}
                    onChange={handleChange('pointRamassage')}
                    aria-invalid={Boolean(errors.pointRamassage)}
                  >
                    <option value="">— Choisir —</option>
                    {pointRamassage.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {errors.pointRamassage && (
                    <span className="field-error">{errors.pointRamassage}</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block"
                  disabled={submitting}
                >
                  {submitting ? 'Enregistrement…' : "S'inscrire"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
