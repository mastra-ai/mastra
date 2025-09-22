# 🚂 Configuration Railway MCP

## 1. Obtenir votre token Railway API

1. Allez sur https://railway.app/account/tokens
2. Connectez-vous à votre compte Railway
3. Cliquez sur "Create New Token"
4. Donnez un nom au token (ex: "MCP Access")
5. Copiez le token généré

## 2. Configurer le token dans votre environnement

### Option A: Variable d'environnement (recommandé)
```bash
# Ajouter dans ~/.bashrc ou ~/.zshrc
export RAILWAY_API_TOKEN="your-token-here"

# Recharger le shell
source ~/.bashrc
```

### Option B: Fichier .env local
```bash
# Dans le projet
echo "RAILWAY_API_TOKEN=your-token-here" >> .env
```

## 3. Vérifier le déploiement failed

Une fois le token configuré, je pourrai :

1. **Voir le statut du déploiement**
   - Identifier pourquoi il a échoué
   - Récupérer les logs d'erreur

2. **Analyser les erreurs communes Railway**
   - Build failed (problème de package.json)
   - Start command incorrect
   - Port binding issues
   - Memory/resource limits
   - Missing environment variables

3. **Actions possibles**
   - Redéployer avec fix
   - Rollback à une version précédente
   - Ajuster la configuration
   - Voir les logs détaillés

## 4. Commandes utiles Railway

```bash
# Via Railway CLI
railway login
railway status
railway logs
railway redeploy

# Via MCP (une fois token configuré)
- deployment_status
- deployment_logs
- service_info
- deployment_trigger
```

## Votre déploiement: f9bbf288-1d12-4d00-96d7-030458c10541

Ce déploiement a FAILED. Les causes possibles :

1. **Erreur de build**
   - Package.json manquant ou incorrect
   - Dependencies non installées
   - TypeScript compilation errors

2. **Erreur de démarrage**
   - Port non configuré (Railway utilise $PORT)
   - Start command incorrect
   - Crash au démarrage

3. **Erreur de configuration**
   - Variables d'environnement manquantes
   - Mauvaise version de Node
   - Mémoire insuffisante

**Donnez-moi votre token Railway et je diagnostiquerai le problème immédiatement!**