# IPSEIS - Backend API

**API REST pour la plateforme de formation IPSEIS, certifiee Qualiopi.**

> Backend Express.js avec authentification JWT, messagerie en temps reel, gestion de contrats et distribution de ressources pedagogiques.

## Apercu

API backend complete pour la plateforme IPSEIS. Gere l'authentification multi-roles, le catalogue de formations, la contractualisation, la messagerie interne en temps reel et la distribution securisee de ressources pedagogiques.

## Stack technique

| Technologie | Usage |
|---|---|
| **Express.js** | Framework web Node.js |
| **MongoDB** | Base de donnees (Mongoose ODM) |
| **JWT** | Authentification via cookies httpOnly |
| **Socket.io** | Messagerie et notifications en temps reel |
| **Nodemailer** | Envoi d'emails (Gmail SMTP) |
| **Multer** | Upload de fichiers (contrats, ressources PDF) |
| **bcrypt** | Hashage des mots de passe |
| **Docker** | Conteneurisation pour le deploiement |

## Fonctionnalites

### Authentification et autorisation

- Authentification JWT avec cookies httpOnly (protection XSS)
- 3 roles : `administrateur`, `apprenant`, `professionnel`
- Systeme de codes d'activation (lies a un email + role, expiration 7 jours)
- Reset de mot de passe par email (token a usage unique, expiration 1h)
- Middleware RBAC (Role-Based Access Control)

### Gestion des formations

- CRUD complet sur les themes et formations
- Controle de visibilite par l'administrateur
- Informations detaillees : objectifs, programme, methodes, formateur, duree, tarifs

### Gestion des contrats

- Workflow complet : brouillon -> envoye -> signe/refuse/annule
- Upload et telechargement de PDF
- Signature et refus par les utilisateurs
- Suivi administrateur

### Messagerie

- **Contact public** : formulaire avec gestion admin (lecture, reponse par email)
- **Messagerie interne** : conversations entre utilisateurs avec archivage
- **Temps reel** : Socket.io avec compteurs de messages non lus
- Notifications email automatiques

### Ressources pedagogiques

- Upload de documents PDF lies aux formations
- Controle d'acces par role
- Telechargement securise

### Administration

- Dashboard avec statistiques agregees
- Gestion des utilisateurs et codes d'activation
- Gestion des prospects (contact, conversion, suivi de statut)
- Checklists de suivi

## Architecture

```
├── app.js                  # Configuration Express (CORS, middlewares, routes)
├── bin/www                 # Serveur HTTP + configuration Socket.io
├── db/
│   ├── connection.js       # Connexion MongoDB Atlas
│   └── db.js               # Registre des modeles
├── models/
│   ├── User.js             # Utilisateurs (roles, credentials)
│   ├── Training.js         # Formations
│   ├── Theme.js            # Categories de formations
│   ├── Contract.js         # Contrats (workflow de signature)
│   ├── Resource.js         # Ressources pedagogiques (PDF)
│   ├── Message.js          # Messages de contact
│   ├── InternalMessage.js  # Messagerie interne
│   ├── ActivationCode.js   # Codes d'activation (inscription)
│   ├── PasswordResetToken.js
│   ├── Prospect.js         # Leads et prospects
│   ├── Interaction.js      # Historique d'interactions prospects
│   ├── Checklist.js        # Checklists de suivi
│   └── ArchivedConversation.js
├── routes/
│   ├── auth.js             # Authentification (register, login, reset)
│   ├── admin.js            # Administration (users, codes, trainings, prospects)
│   ├── trainings.js        # Catalogue public
│   ├── contracts.js        # Gestion des contrats (admin + user)
│   ├── resources.js        # Ressources pedagogiques
│   ├── messages.js         # Messages de contact
│   ├── internalMessages.js # Messagerie interne
│   └── themes.js           # Themes de formation
├── middleware/
│   ├── authMiddleware.js   # Verification JWT (cookie)
│   └── roleMiddleware.js   # Controle d'acces par role
├── scripts/
│   └── seedAdmin.js        # Creation du compte administrateur initial
└── Dockerfile              # Image Docker (Node 25-alpine)
```

## Endpoints API

### Authentification (`/auth`)

| Methode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Inscription avec code d'activation |
| POST | `/auth/login` | Connexion (option "se souvenir de moi") |
| POST | `/auth/logout` | Deconnexion |
| GET | `/auth/me` | Profil utilisateur courant |
| PUT | `/auth/profile` | Mise a jour du profil |
| PUT | `/auth/change-password` | Changement de mot de passe |
| POST | `/auth/forgot-password` | Demande de reset |
| POST | `/auth/reset-password` | Reset du mot de passe |

### Catalogue (`/trainings`)

| Methode | Route | Description |
|---|---|---|
| GET | `/trainings/all` | Themes avec formations |
| GET | `/trainings/by-id/:id` | Detail d'une formation |
| GET | `/trainings/by-theme/:id` | Formations par theme |

### Contrats (`/contracts`)

| Methode | Route | Description |
|---|---|---|
| POST | `/contracts/admin` | Creer un contrat |
| GET | `/contracts/admin` | Lister les contrats |
| PUT | `/contracts/admin/:id` | Modifier un contrat |
| PATCH | `/contracts/admin/:id/send` | Envoyer au signataire |
| PATCH | `/contracts/admin/:id/cancel` | Annuler |
| GET | `/contracts/my` | Mes contrats (utilisateur) |
| PATCH | `/contracts/my/:id/sign` | Signer un contrat |
| PATCH | `/contracts/my/:id/reject` | Refuser un contrat |
| GET | `/contracts/download/:id` | Telecharger le PDF |

### Ressources (`/resources`)

| Methode | Route | Description |
|---|---|---|
| POST | `/resources/admin` | Ajouter une ressource |
| GET | `/resources/admin` | Lister les ressources |
| PUT | `/resources/admin/:id` | Modifier une ressource |
| DELETE | `/resources/admin/:id` | Supprimer une ressource |
| GET | `/resources/my` | Mes ressources (utilisateur) |
| GET | `/resources/download/:id` | Telecharger le PDF |

### Administration (`/admin`)

| Methode | Route | Description |
|---|---|---|
| GET | `/admin/dashboard/stats` | Statistiques du dashboard |
| POST | `/admin/activation-codes` | Generer des codes |
| GET | `/admin/activation-codes` | Lister les codes |
| GET | `/admin/users` | Lister les utilisateurs |
| PUT | `/admin/users/:id` | Modifier un utilisateur |
| DELETE | `/admin/users/:id` | Desactiver un utilisateur |
| POST | `/admin/trainings` | Creer une formation |
| PUT | `/admin/trainings/:id` | Modifier une formation |
| DELETE | `/admin/trainings/:id` | Supprimer une formation |
| PATCH | `/admin/trainings/:id/visibility` | Basculer la visibilite |
| GET | `/admin/prospects` | Lister les prospects |
| POST | `/admin/prospects/:id/convert` | Convertir en utilisateur |

### Messages (`/messages`)

| Methode | Route | Description |
|---|---|---|
| POST | `/messages/new` | Nouveau message (public) |
| GET | `/messages/catalogue` | Demande de catalogue |
| GET | `/messages/admin` | Lister les messages (admin) |
| POST | `/messages/admin/:id/reply` | Repondre par email |

### Messagerie interne (`/internal-messages`)

| Methode | Route | Description |
|---|---|---|
| GET | `/internal-messages/` | Mes conversations |
| POST | `/internal-messages/` | Envoyer un message |
| GET | `/internal-messages/unread-count` | Messages non lus |

### Sante (`/health`)

| Methode | Route | Description |
|---|---|---|
| GET | `/health` | Statut API + connexion MongoDB |

## Modeles de donnees

| Modele | Description |
|---|---|
| **User** | Utilisateurs avec roles, credentials et informations de contact |
| **Theme** | Categories de formations |
| **Training** | Formations (objectifs, programme, methodes, evaluation, tarifs) |
| **Contract** | Contrats avec workflow de signature et PDF |
| **Resource** | Documents PDF lies aux formations |
| **ActivationCode** | Codes d'inscription (email + role, expiration 7j) |
| **PasswordResetToken** | Tokens de reset (expiration 1h) |
| **Message** | Messages du formulaire de contact |
| **InternalMessage** | Messages internes entre utilisateurs |
| **Prospect** | Leads avec historique d'interactions |
| **Checklist** | Listes de suivi (items cochables) |

## Securite

- **JWT** en cookies httpOnly avec SameSite
- **bcrypt** pour le hashage des mots de passe (10 rounds)
- **RBAC** avec middleware de verification de role
- **Expiration des tokens** : codes d'activation (7j), reset password (1h)
- **Prevention d'enumeration** sur la route forgot-password
- **CORS** configure avec credentials

## Demarrage rapide

### Prerequis

- Node.js 18+
- MongoDB (local ou Atlas)
- Compte Gmail avec mot de passe d'application (pour l'envoi d'emails)

### Installation

```bash
npm install
```

### Variables d'environnement

Creer un fichier `.env` :

```env
USER_AGENT_ENV=dev
MONGODB_URI=mongodb+srv://...
FRONTEND_URL=http://localhost:4001
JWT_SECRET=votre-secret-jwt
NODEMAILER_EMAIL=votre-email@gmail.com
NODEMAILER_PASSWORD=votre-mot-de-passe-app
PORT=3098
```

### Initialiser le compte administrateur

```bash
node scripts/seedAdmin.js
```

### Lancer le serveur

```bash
# Developpement (avec nodemon)
yarn dev

# Production
npm start
```

L'API est accessible sur [http://localhost:3098](http://localhost:3098).

## Docker

L'image Docker est disponible en prive sur Docker Hub.

```dockerfile
# Build
docker build -t ipseis-backend .

# Run
docker run -p 3098:3098 --env-file .env ipseis-backend
```

> **Note** : L'image Docker est privee (`jyok1m/ipseis-backend`). Contactez le mainteneur pour obtenir l'acces.

## CI/CD

Pipeline Jenkins automatise :

1. Build de l'image Docker
2. Push vers Docker Hub (registre prive)
3. Deploiement via SSH sur le serveur de production
4. Orchestration avec Docker Compose

Environnements : `dev`, `stg` (staging), `main` (production).

## Temps reel (Socket.io)

- Authentification par cookie JWT
- Rooms par utilisateur (`user:{userId}`)
- Emission des compteurs de messages non lus
- Notifications instantanees de nouveaux messages

## Liens

- **Frontend** : [ipseis](https://github.com/Jyok1m/ipseis)
