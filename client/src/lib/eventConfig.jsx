import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getEventConfig } from './api';

/** Valeurs par defaut : identique a server/config/event.js (secours si l'API est lente). */
const FALLBACK = {
  event: {
    title: 'JOURNÉE DE FORMATION ET DE DÉTENTE',
    dateLabel: '17 OCTOBRE 2026',
    dateISO: '2026-10-17',
    location: 'Hôtel Africa Queen – Somone',
    organizer: 'EXPHA',
    speaker: 'Professeur Bamba Ndiaye',
  },
  invitePar: [
    'Maixent Dione',
    'Mme Gaye Khady Sokhna',
    'Mme Maguette Diop',
    'Mme Sow Aminata',
    'Mme Niang Cor',
  ],
  pointRamassage: ['Terminus DEM DIK-HLM GRAND YOFF', 'EDK Pikine', 'Sortie 9 – Sedima'],
  presence: ['Oui', 'Non'],
};

const EventConfigContext = createContext(FALLBACK);

export function EventConfigProvider({ children }) {
  const [config, setConfig] = useState(FALLBACK);

  useEffect(() => {
    const controller = new AbortController();
    getEventConfig(controller.signal)
      .then((res) => {
        if (res && res.ok && res.data) setConfig(res.data);
      })
      .catch(() => {
        /* valeurs par defaut conservees */
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(
    () => ({
      event: config.event || FALLBACK.event,
      invitePar: config.invitePar?.length ? config.invitePar : FALLBACK.invitePar,
      pointRamassage: config.pointRamassage?.length
        ? config.pointRamassage
        : FALLBACK.pointRamassage,
      presence: config.presence?.length ? config.presence : FALLBACK.presence,
    }),
    [config]
  );

  return <EventConfigContext.Provider value={value}>{children}</EventConfigContext.Provider>;
}

export function useEventConfig() {
  return useContext(EventConfigContext);
}
