# Éveil

Réveil intelligent et suivi du sommeil inspiré d’Alarmy, conçu dans une interface épurée (Clair, Sombre et Système) disponible en version web, en fichier `.html` autonome et en application Android `.apk`.

## Fonctionnalités

- **Alarmes récurrentes et ponctuelles** : sélection des jours de la semaine, rappel (snooze) avec limite configurable, volume progressif (crescendo) et alarme rapide `+1 min`.
- **Défis de réveil obligatoires** : calcul mental, mémoire visuelle, secousses actives (accéléromètre ou rythme manuel), recopie lucide (sans copier-coller) et point de passage caméra/code.
- **Vérification de réveil** : contrôle automatique après l’arrêt d’une alarme (délai configurable) avec compte à rebours de 60 secondes avant redéclenchement.
- **Mode de suivi du sommeil** : chronométrage nocturne, ambiances d’endormissement minutées, détection locale optionnelle des pics sonores, graphique sur 7 nuits et journal des réveils.
- **7 sonneries synthétisées localement** : utilisables hors ligne, routées sur le canal système **Alarme (`USAGE_ALARM`)** dans la version Android `.apk`.
- **Vibration montre connectée** : relais d’impulsions toutes les 12 secondes vers les montres **Amazfit (Zepp)**, Garmin, Samsung Galaxy Watch, Xiaomi Mi Fitness, Fitbit et Wear OS (il suffit d’activer Éveil dans les notifications d’applications de votre montre).
- **Apparence adaptative** : choix **Clair**, **Sombre** ou **Système** (suivi automatique du thème de l’appareil et couleur dynamique Material You sur Android 12+).

## Obtenir le fichier `.apk` Android automatiquement

Ce dépôt inclut le projet natif Android (`/android`) ainsi que le workflow GitHub Actions (`.github/workflows/build-apk.yml`) :

1. Après avoir poussé le projet sur GitHub, ouvrez l’onglet **Actions**.
2. Lancez ou ouvrez l’exécution **Build Éveil Android APK**.
3. Téléchargez l’artefact **eveil-android-apk** et installez `app-debug.apk` sur votre téléphone Android.
4. Au premier lancement, accordez les autorisations proposées (affichage au-dessus des autres applications, alarmes exactes et batterie sans restriction).

## Lancer la version web localement

```bash
npm install
npm run dev
```

Pour générer une build de production :

```bash
npm run build
```
