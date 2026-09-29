# 🚀 Journée de formation et de détente — plateforme d'inscription

Application web complète (React + Vite / Node.js + Express / MongoDB) permettant de
recueillir les inscriptions à la **Journée de formation et de détente** et de les
consulter **en temps réel** depuis un espace administrateur.

| | |
| --- | --- |
| **Événement** | Journée de formation et de détente |
| **Date** | 17 octobre 2026 |
| **Lieu** | Hôtel Africa Queen – Somone |
| **Organisé par** | EXPHA |
| **Intervenant** | Professeur Bamba Ndiaye |

---

## 1. Fonctionnalités

### Page d'accueil `/`

* Bandeau d'accueil : titre, **17 OCTOBRE 2026**, 📍 Hôtel Africa Queen – Somone,
  **Organisé par EXPHA**, **Avec le Professeur Bamba Ndiaye**.
* Formulaire d'inscription **centré**, 6 champs, **tous obligatoires** :
  Nom, Prénom, Numéro de téléphone, Structure médicale, Invité(e) par, Point de ramassage.
* Validation côté client **et** côté serveur — les soumissions vides ou invalides
  sont refusées (bouton désactivé visuellement, messages d'erreur champ par champ).
* Après validation : message **« Votre inscription a bien été enregistrée. Merci et à bientôt ! »**,
  **numéro d'inscription unique** (`EXPHA-2026-0001`) et récapitulatif.
* Compteur public du nombre d'inscrits.

### Espace administrateur `/admin`

* Connexion par mot de passe simple (session JWT en cookie `httpOnly`).
* Tableau **mis à jour en temps réel** (Server-Sent Events) sans rechargement de page.
* Colonnes : N° · Nom · Prénom · Téléphone · Structure médicale · Invité(e) par ·
  Point de ramassage · Date d'inscription.
* **Nombre total d'inscrits** + résultats affichés + répartitions.
* **Recherche** par nom / prénom / téléphone (ou n° d'inscription).
* **Filtres** par invité(e) par, point de ramassage, structure médicale (combinables).
* **Export Excel (.xls) et CSV** — tenant compte des filtres actifs.
* Tri, suppression d'une inscription, bouton d'actualisation manuelle.
* Repli automatique : si le flux temps réel est coupé, rafraîchissement toutes les 20 s.

---

## 2. Stack technique

```
Frontend   React 18 + Vite (SPA, React Router)
Backend    Node.js + Express (API REST + SSE)
Base       MongoDB + Mongoose (persistante)
```

Structure du projet :

```
Expha/
├── package.json              # racine : API Express + scripts
├── render.yaml               # configuration de déploiement Render
├── .env.example              # variables d'environnement à copier
├── server/
│   ├── index.js              # démarrage, connexion MongoDB
│   ├── app.js                # middlewares, routes, service du frontend compilé
│   ├── config/
│   │   ├── index.js          # variables d'environnement
│   │   └── event.js          # ⚙️ date, lieu, listes déroulantes (source unique)
│   ├── models/
│   │   ├── Registration.js   # schéma MongoDB
│   │   └── Counter.js        # compteur atomique des n° d'inscription
│   ├── routes/
│   │   ├── registrations.js  # API publique + API admin
│   │   └── admin.js          # connexion, flux temps réel (SSE)
│   ├── middleware/auth.js    # protection JWT de /admin
│   └── lib/
│       ├── validation.js     # validation + normalisation des données
│       ├── registrationsService.js  # recherche, filtres, statistiques
│       ├── export.js         # génération CSV / Excel
│       └── eventsHub.js      # diffusion SSE
├── client/
│   ├── src/pages/Home.jsx    # page d'accueil + formulaire
│   ├── src/pages/Admin.jsx   # espace administrateur
│   ├── src/lib/              # api, validation, configuration
│   ├── src/index.css         # design responsive
│   ├── ssr-check.jsx         # 29 tests de rendu de l'interface
│   └── ssr-event.js          # valeurs de secours alignées sur server/config/event.js
└── scripts/
    ├── dev-with-mongo-memory.js  # API + MongoDB en mémoire (test local)
    ├── smoke-test.js             # 66 tests de bout en bout
    └── verify-static.js          # vérification du service des fichiers
```

---

## 3. Lancer le projet en local

### Option A — MongoDB déjà installé

```bash
npm install
npm --prefix client install
cp .env.example .env      # puis renseigner MONGODB_URI
npm run dev
```

* Site : <http://localhost:5173>
* API : <http://localhost:4000>

### Option B — sans installer MongoDB (test immédiat)

```bash
npm install
npm --prefix client install
npm run dev:local         # démarre une base MongoDB en mémoire + l'API
```

Puis, dans un second terminal :

```bash
npm --prefix client run dev
```

> Les données de l'option B sont **volatiles** (supprimées à l'arrêt).
> Pour un test rapide de l'interface uniquement : `npm run dev:local` puis
> <http://localhost:4000> sert directement l'API.

### Mot de passe administrateur

Par défaut `expha2026` (valeur définie dans `.env`) — **à changer en production**.

---

## 4. Tests

```bash
npm run check          # tout lancer
```

| Commande | Ce qu'elle vérifie |
| --- | --- |
| `npm run smoke` | 66 tests API : validation, inscription, n° uniques, auth, recherche, filtres, exports CSV/Excel, flux SSE, suppression, anti-spam, sécurité |
| `npm run verify:static` | 10 tests : Express sert bien le frontend compilé (`/`, `/admin`, routes inconnues, assets) |
| `npm run verify:ui` | 29 tests : rendu React des pages, présence des 6 champs et des 8 options, page 404 |

Les tests utilisent une base MongoDB **en mémoire** : aucune installation requise
et aucun risque pour vos données.

---

## 5. API REST

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | état du service |
| `GET` | `/api/event` | public | date, lieu, options des listes |
| `GET` | `/api/registrations/stats` | public | nombre d'inscrits |
| `POST` | `/api/registrations` | public | **créer une inscription** |
| `POST` | `/api/admin/login` | public | connexion (mot de passe) |
| `POST` | `/api/admin/logout` | admin | déconnexion |
| `GET` | `/api/admin/me` | admin | vérifie la session |
| `GET` | `/api/admin/stream` | admin | **flux temps réel (SSE)** |
| `GET` | `/api/registrations` | admin | liste paginée + filtres |
| `GET` | `/api/registrations/dashboard` | admin | liste + statistiques + valeurs distinctes |
| `GET` | `/api/registrations/export.csv` | admin | export CSV (UTF-8 BOM) |
| `GET` | `/api/registrations/export.xls` | admin | export Excel |
| `DELETE` | `/api/registrations/:id` | admin | supprimer une inscription |

### Exemple d'inscription

```bash
curl -X POST http://localhost:4000/api/registrations \
  -H "Content-Type: application/json" \
  -d '{
        "nom": "Diop",
        "prenom": "Awa",
        "telephone": "77 123 45 67",
        "structureMedicale": "Centre de santé de Somone",
        "invitePar": "Maixent Dione",
        "pointRamassage": "Terminus Dem Dikk"
      }'
```

Réponse `201` :

```json
{
  "ok": true,
  "message": "Votre inscription a bien été enregistrée. Merci et à bientôt !",
  "data": { "numeroInscription": "EXPHA-2026-0001", "...": "..." }
}
```

En cas d'erreur, le serveur renvoie le détail par champ :

```json
{
  "ok": false,
  "message": "Certains champs sont invalides ou manquants.",
  "errors": { "telephone": "Numero invalide. Exemple : 77 123 45 67" }
}
```

---

## 6. Modèle de données

Collection **`registrations`** :

```text
Registration
├── nom                String   requis
├── prenom             String   requis
├── telephone          String   requis (9 chiffres, normalisé)
├── structureMedicale  String   requis
├── invitePar          String   requis (liste fermée)
├── pointRamassage     String   requis (liste fermée)
├── numeroInscription  String   unique  ex. EXPHA-2026-0001
├── createdAt          Date     indexé
└── updatedAt          Date
```

Collection **`counters`** : compteur atomique (`registration`) garantissant
des numéros **uniques et sans trou**, même en cas d'inscriptions simultanées.

Index : `numeroInscription` (unique), `createdAt`, `nom + prenom`, `invitePar`,
`pointRamassage`, `structureMedicale`.

---

## 7. Personnaliser l'événement

Tout est centralisé dans **`server/config/event.js`** : date, lieu, organisateur,
intervenant, et les deux listes déroulantes. Ce fichier alimente l'API, qui
distribue ensuite ces valeurs au frontend — **une seule modification à faire**.

Les numéros d'inscription sont générés depuis `INSCRIPTION_PREFIX` dans le même
fichier.

---

## 8. Déploiement sur Render + MongoDB Atlas

### 8.1 Créer la base sur MongoDB Atlas

1. <https://www.mongodb.com/atlas> → **Create a deployment** (free / M0).
2. **Database Access** → *Add New Database User* (ex. `expha`) → donner le rôle
   `Read and write to any database`.
3. **Network Access** → *Allow access from anywhere* (`0.0.0.0/0`, obligatoire :
   Render a des IP variables).
4. **Deployments → Database** → *Connect* → choisir **Node.js** →
   copier l'URI et remplacer `<password>` :

```text
mongodb+srv://expha:<password>@cluster0.xxxxx.mongodb.net/expha?retryWrites=true&w=majority
```

> Le mot de passe doit être **encodé** (pas de `/ @ : # [ ]` en clair —
> un `!` devient `%21`, etc.).

### 8.2 Déployer sur Render

**Par le dashboard**

1. <https://dashboard.render.com> → **New +** → **Web Service** → **connecter le dépôt GitHub**.
2. Réglages :

| Champ | Valeur |
| --- | --- |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

3. Variables d'environnement :

| Clé | Valeur |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | l'URI Atlas de l'étape 8.1 |
| `JWT_SECRET` | une longue chaîne aléatoire (ex. `openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | le mot de passe de votre choix |
| `RATE_LIMIT_MAX` | `30` (inscriptions max par quart d'heure et par IP) |

4. **Create Web Service**. Le site est en ligne sur `https://expha-xxx.onrender.com`.

**Par le fichier `render.yaml`** : pushed sur GitHub → *New +* → *Blueprint* →
sélectionner le dépôt. Il ne reste qu'à saisir `MONGODB_URI` et `ADMIN_PASSWORD`.

### 8.3 Après le déploiement

* Ouvrir `/admin`, saisir `ADMIN_PASSWORD` → tableau temps réel.
* Vérifier `/api/health` → `{"ok":true,...}`.

### 8.4 Points d'attention

* **Free tier** : le service s'endort après 15 min d'inactivité ; la première requête
  prend ~50 s. Sur un plan payant, l'onglet admin reste instantané.
* Le flux SSE utilise des connexions HTTP longues : Render les gère correctement
  (`compression()` et le cache `no-transform` sont configurés). Si un proxy
  coupe malgré tout la connexion, l'admin bascule automatiquement en
  rafraîchissement toutes les 20 s.
* **`NODE_VERSION=22`** est fixé dans `render.yaml` pour un environnement reproductible.
* **`--include=dev` est obligatoire dans le Build Command** : `NODE_ENV=production`
  fait ignorer les `devDependencies` à `npm install`, donc `vite` ne serait pas
  installé et le build du client échouerait.

---

## 9. Sécurité mise en place

* Mots de passe et jetons jamais stockés en base ni exposés au client.
* Session admin : JWT signé, cookie `httpOnly` + `SameSite=Lax` + `Secure` en production.
* Comparaison du mot de passe à temps constant ; limitation des tentatives de
  connexion (10 / 10 min).
* Anti-spam : 30 inscriptions maximum par IP et par quart d'heure (l'admin
  authentifié n'est jamais limité) ; limite globale plus large sur l'API.
* Requêtes Mongo passées par l'API de requête de `mongoose` (aucune
  concaténation de chaînes) ; les valeurs des listes sont validées par `enum`.
* `helmet`, `cors` restreint, corps de requête limité à 50 ko.
* Toute inscription est **réellement persistée dans MongoDB** — aucun
  `localStorage` (le seul usage de `localStorage` est le jeton de session admin).
