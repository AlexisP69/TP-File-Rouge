# Architecture du TP Fil Rouge

Ce document décrit l'architecture globale de l'application Helpdesk déployée sur Kubernetes.

## Composants

- **Frontend** : application web statique servie par Nginx
- **Backend** : API REST Node.js (Express + PostgreSQL)
- **Base de données** : PostgreSQL avec persistance via PVC
- **Prometheus** : collecte de métriques exposées par le backend
- **Grafana** : visualisation des métriques Prometheus

## Flux principaux

1. L'utilisateur accède à l'URL exposée par l'Ingress (`fil-rouge.local`).
2. Les requêtes HTTP sont routées :
   - vers le `Service frontend` pour `/`
   - vers le `Service backend` pour `/api`
3. Le backend interagit avec PostgreSQL pour créer et lire des tickets.
4. Le backend expose des métriques sur `/metrics`.
5. Prometheus scrute périodiquement le backend et stocke les métriques.
6. Grafana interroge Prometheus et affiche les métriques dans des dashboards.
