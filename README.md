<div align="center">
  <img src="public/logo.jpeg" alt="Veilleur" width="160" />
</div>

# Veilleur

Bot Discord de veille technologique. Lance `/veille` dans un canal, il parcourt l'historique, extrait les liens partagés et génère une liste de lecture synthétique - visible uniquement par toi. Lance `/stats` pour compter et retrouver les messages d'une période, par auteur ou par terme.

## Fonctionnement

```
/veille canal:#tech-watch période:7j
```

Le bot :

1. Lit tous les messages du canal sur la période demandée
2. Extrait les URLs (en ignorant les liens Discord, GIFs, CDN...)
3. Récupère le contexte rédigé par l'auteur du message
4. Résume et catégorise chaque lien avec Claude AI (si `ANTHROPIC_API_KEY` configurée)
5. Répond en message éphémère avec la liste groupée par domaine - seul toi vois le résultat
6. Un menu de sélection permet de choisir jusqu'à 6 liens et d'obtenir une liste curation prête à partager

```
/stats canal:#tech-watch début:01/09/2026 fin:30/09/2026 auteur:@alice terme:rust
```

Tout est optionnel sauf le canal (fin par défaut : aujourd'hui, début : 30 jours avant la fin). Le bot répond, sans IA, avec le nombre de messages correspondants, les occurrences du terme, le classement des auteurs et des domaines partagés, puis la liste paginée des messages avec un lien vers chacun.

## Stack

- [Next.js 16](https://nextjs.org) - App Router, déployé sur Vercel
- [Anthropic Claude](https://anthropic.com) - Résumé et catégorisation des liens
- [Discord REST API](https://discord.com/developers/docs) - Lecture des messages et interactions slash commands
- [Redis Cloud](https://redis.com) - Cache des rapports (TTL 6h, fallback in-memory en dev)

## Prérequis

- Node.js 24 (voir `.nvmrc`)
- Un serveur Discord avec les droits d'administration
- Une application Discord (voir [doc/DISCORD.md](doc/DISCORD.md))
- Une clé API Anthropic (optionnelle - le bot fonctionne sans, sans résumé IA)

## Installation

```bash
git clone https://github.com/your-org/veilleur
cd veilleur
cp .env.example .env.local  # remplir les variables
make install
make discord-register       # enregistre les commandes /veille et /stats
```

Variables d'environnement :

| Variable                 | Obligatoire | Description                                     |
| ------------------------ | ----------- | ----------------------------------------------- |
| `DISCORD_PUBLIC_KEY`     | oui         | Clé publique Ed25519 (Discord Developer Portal) |
| `DISCORD_APPLICATION_ID` | oui         | ID de l'application Discord                     |
| `DISCORD_BOT_TOKEN`      | oui         | Token du bot Discord                            |
| `ANTHROPIC_API_KEY`      | non         | Clé API Claude - active le résumé IA            |
| `REDIS_URL`              | non         | URL Redis Cloud - fallback in-memory si absent  |

## Développement

```bash
make dev          # serveur sur http://localhost:7788
make check        # format + lint + typecheck + tests (CI gate)
make test-unit    # tests unitaires Vitest
```

Pour tester les interactions Discord en local, exposer le serveur avec ngrok :

```bash
make start
ngrok http 7788
# Coller https://xxxx.ngrok-free.app/api/discord dans Discord > Interactions Endpoint URL
```

## Déploiement

```bash
vercel --prod
# Puis mettre à jour l'Interactions Endpoint URL dans Discord Developer Portal
```

Voir [doc/DEPLOY.md](doc/DEPLOY.md) pour le détail complet.

## Configuration Discord

Voir [doc/DISCORD.md](doc/DISCORD.md) pour :

- Créer l'application Discord
- Inviter le bot sur un serveur
- Donner accès aux canaux restreints
- Configurer l'endpoint d'interactions

## Licence

MIT
