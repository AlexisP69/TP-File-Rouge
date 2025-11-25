# Fil Rouge – Déploiement d'une application Helpdesk sur Kubernetes

## 📌 Contexte

Ce dépôt contient le **TP Fil Rouge** autour de Kubernetes.  
Objectif : déployer une application de gestion de tickets (*Helpdesk*) composée de plusieurs services sur un cluster Kubernetes, en appliquant des concepts avancés (ingress, persistance, secrets, autoscaling, supervision, etc.).

L'application est découpée en plusieurs composants :

- `frontend` : interface web permettant de consulter et créer des tickets
- `backend-api` : API REST exposant les opérations de gestion des tickets
- `database` : base de données relationnelle pour stocker les tickets
- `prometheus` : collecte de métriques
- `grafana` : visualisation et tableaux de bord

---

## 🎯 Objectifs pédagogiques

- Conteneuriser une application multi-services
- Déployer ces services sur Kubernetes avec :
  - `Deployment` + `Service`
  - `Ingress` pour l'exposition externe
  - `ConfigMap` et `Secret` pour la configuration
  - `PersistentVolumeClaim` pour la persistance des données
- Mettre en place des sondes de santé (`livenessProbe`, `readinessProbe`)
- Configurer un `HorizontalPodAutoscaler` (HPA)
- Mettre en place un début de supervision avec **Prometheus + Grafana**
- Documenter et versionner l'ensemble sur **GitHub**

---

## 🏗 Architecture cible

Architecture logique :

```text
[ Utilisateur ] 
     |
   (HTTP)
     |
  [ Ingress (fil-rouge.local) ]
     |
     +-- / ----> [ Service frontend ] ---> [ Pods frontend ]
     |
     +-- /api -> [ Service backend ]  ---> [ Pods backend ]
                                       |
                                       v
                               [ Service postgres ] -> [ Pods PostgreSQL + PVC ]

Supervision :

[ Prometheus ] ----scrape----> [ Service backend (/metrics) ]
       |
       v
[ Grafana ] --- dashboards ---> Consultation par l'utilisateur
```

---

## 📁 Structure du dépôt

```text
.
├─ k8s/
│  ├─ namespace.yaml
│  ├─ configmap-backend.yaml
│  ├─ configmap-frontend.yaml
│  ├─ secret-db.yaml
│  ├─ postgres-pvc.yaml
│  ├─ postgres-deployment.yaml
│  ├─ postgres-service.yaml
│  ├─ backend-deployment.yaml
│  ├─ backend-service.yaml
│  ├─ frontend-deployment.yaml
│  ├─ frontend-service.yaml
│  ├─ ingress.yaml
│  ├─ hpa-backend.yaml
│  ├─ prometheus-configmap.yaml
│  ├─ prometheus-deployment.yaml
│  ├─ prometheus-service.yaml
│  ├─ grafana-deployment.yaml
│  ├─ grafana-service.yaml
├─ app/
│  ├─ backend/
│  └─ frontend/
└─ docs/
   └─ architecture.md
```

---

## 🔧 Prérequis

- Docker
- Un cluster Kubernetes local :
  - `minikube` **ou** `kind`
- `kubectl` configuré
- (Optionnel) accès à un registre Docker (Docker Hub, GHCR…)

---

## 🧱 Construction des images Docker

### Backend

Depuis `app/backend` :

```bash
cd app/backend
docker build -t fil-rouge-backend:latest .
```

### Frontend

Depuis `app/frontend` :

```bash
cd app/frontend
docker build -t fil-rouge-frontend:latest .
```

> 💡 Avec **minikube**, pense à faire :
> ```bash
> eval $(minikube docker-env)
> ```
> avant de builder pour que le cluster voie les images locales.

---

## 🚀 Déploiement sur Kubernetes

Depuis la racine du dépôt :

### 1. Namespace

```bash
kubectl apply -f k8s/namespace.yaml
kubectl config set-context --current --namespace=fil-rouge
```

### 2. ConfigMaps & Secrets

```bash
kubectl apply -f k8s/configmap-backend.yaml
kubectl apply -f k8s/configmap-frontend.yaml
kubectl apply -f k8s/secret-db.yaml
```

### 3. Base de données PostgreSQL

```bash
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
```

### 4. Backend & frontend

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

### 5. Ingress

Avec minikube, activer l'ingress :

```bash
minikube addons enable ingress
```

Puis appliquer l’ingress :

```bash
kubectl apply -f k8s/ingress.yaml
```

Récupérer l'IP du cluster :

```bash
minikube ip
```

Ajouter dans `/etc/hosts` :

```text
<IP_MINIKUBE>  fil-rouge.local
```

L'application sera alors accessible sur :  
👉 http://fil-rouge.local

---

## 📊 Autoscaling

Appliquer le HPA sur le backend :

```bash
kubectl apply -f k8s/hpa-backend.yaml
kubectl get hpa -n fil-rouge
```

---

## 📈 Supervision : Prometheus & Grafana

### 1. Déployer Prometheus

```bash
kubectl apply -f k8s/prometheus-configmap.yaml
kubectl apply -f k8s/prometheus-deployment.yaml
kubectl apply -f k8s/prometheus-service.yaml
```

Prometheus est configuré pour **scraper le backend** sur `/metrics` via le service `backend`.

Accès (exemple par port-forward) :

```bash
kubectl port-forward svc/prometheus 9090:9090
```

Interface disponible sur : http://localhost:9090

---

### 2. Déployer Grafana

```bash
kubectl apply -f k8s/grafana-deployment.yaml
kubectl apply -f k8s/grafana-service.yaml
```

Accès (exemple par port-forward) :

```bash
kubectl port-forward svc/grafana 3000:3000
```

Interface disponible sur : http://localhost:3000

Par défaut :
- utilisateur : `admin`
- mot de passe : `admin`

Il faudra ensuite :
- ajouter une datasource **Prometheus** pointant sur `http://prometheus:9090`
- créer un dashboard simple (par exemple : nombre de requêtes HTTP, temps de réponse, etc.)

Les métriques exposées par le backend sont disponibles sur `/metrics`.

---

## 🔍 Tests rapides

- Vérifier les pods :

```bash
kubectl get pods
```

- Vérifier les services :

```bash
kubectl get svc
```

- Voir les logs du backend :

```bash
kubectl logs -l app=backend -f
```

- Accéder à l'UI : http://fil-rouge.local

---

## ✅ Checklist de fin de TP

- [ ] Namespace `fil-rouge` utilisé
- [ ] PostgreSQL déployé avec `PersistentVolumeClaim`
- [ ] Secrets utilisés pour les mots de passe
- [ ] ConfigMaps utilisés pour la configuration non sensible
- [ ] Backend & frontend accessibles via Ingress
- [ ] Probes configurées sur le backend
- [ ] `HorizontalPodAutoscaler` fonctionnel pour le backend
- [ ] Prometheus déployé et capable de scraper le backend
- [ ] Grafana déployé et datasource Prometheus configurée
- [ ] Dashboard Grafana simple créé
- [ ] Documentation complétée (README + docs)

---
