/**
 * Verification hors navigateur : rend l'application React en HTML statique
 * pour detecter les erreurs d'import, de hook ou de rendu.
 *
 * Execute via : npm run verify:ui  (build SSR + rendu)
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import React from 'react';
import App from './src/App';
import { EVENT, INVITE_PAR, POINTS_RAMASSAGE } from './ssr-event';

const checks = [];
const check = (label, cond, detail) =>
  checks.push({ label, ok: Boolean(cond), detail: cond ? '' : detail || '' });

function renderAt(path) {
  return renderToString(
    React.createElement(StaticRouter, { location: path }, React.createElement(App))
  );
}

const home = renderAt('/');
check('accueil rendu', home.length > 500, `longueur ${home.length}`);
check('titre de l evenement', home.includes('JOURNÉE DE FORMATION ET DE DÉTENTE'));
check('date affichee', home.includes('17 OCTOBRE 2026'));
check('lieu affiche', home.includes('Hôtel Africa Queen'));
check('organisateur affiche', home.includes('Organisé par'));
check('professeur affiche', home.includes('Bamba Ndiaye'));
check('libelle du formulaire', home.includes('Formulaire d&#x27;inscription'));
check('champ Nom', home.includes('name="nom"'));
check('champ Prenom', home.includes('name="prenom"'));
check('champ Telephone (type tel)', home.includes('type="tel"'));
check('champ Structure medicale', home.includes('name="structureMedicale"'));
check('champ Invite par', home.includes('name="invitePar"'));
check('champ Point de ramassage', home.includes('name="pointRamassage"'));
check('bouton S inscrire', home.includes('S&#x27;inscrire'));
check('lien vers admin', home.includes('/admin'));
INVITE_PAR.forEach((o) => check(`option invite : ${o}`, home.includes(`>${o}<`)));
POINTS_RAMASSAGE.forEach((o) => check(`option ramassage : ${o}`, home.includes(`>${o}<`)));
check('6 champs obligatoires', home.includes('class="required"'));

const admin = renderAt('/admin');
check('admin rendu (formulaire de connexion)', admin.includes('Espace administrateur'));
check('admin : champ mot de passe', admin.includes('type="password"'));
check('admin : bouton connexion', admin.includes('Se connecter'));
check('admin : pas de tableau avant authentification', !admin.includes('<table'));

const notFound = renderAt('/route-inexistante');
check('page 404', notFound.includes('404'));

let failed = 0;
checks.forEach(({ label, ok, detail }) => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` -> ${detail}`}`);
});
console.log(`\n  ${checks.length - failed} reussis, ${failed} echecs`);
process.exit(failed === 0 ? 0 : 1);
