# 📚 Exemples d'utilisation - Translate-AI

## 🚀 Workflow complet

### 1. Initialisation d'un nouveau projet

```bash
# Dans votre projet React
translate-ai init

# Configuration interactive
✓ Project name: mon-app-react
✓ Frameworks: React
✓ Languages: English (en), French (fr), Spanish (es)
✓ Output directory: ./src/locales
```

### 2. Scanner le projet

```bash
# Scan basique
translate-ai scan

# Scan avec options personnalisées
translate-ai scan -d ./src -o strings.json -e "**/*.test.*"

# Scan avec patterns spécifiques
translate-ai scan -p "src/**/*.tsx" "src/**/*.jsx"
```

### 3. Génération des traductions

```bash
# Avec OpenAI (nécessite OPENAI_API_KEY)
export OPENAI_API_KEY=sk-your-key-here
translate-ai generate -p openai -l fr es de

# Avec DeepL (nécessite DEEPL_API_KEY)
export DEEPL_API_KEY=your-deepl-key
translate-ai generate -p deepl -l fr es it
```

## 📁 Structure des fichiers générés

### Après scan (`translatable-strings.json`)
```json
{
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "totalFiles": 5,
  "totalStrings": 23,
  "files": [
    {
      "file": "src/components/LoginForm.tsx",
      "stringCount": 6,
      "strings": [
        {
          "text": "Se connecter",
          "line": 15,
          "column": 12,
          "context": "<Button>",
          "type": "jsx_text",
          "key": "se_connecter"
        },
        {
          "text": "Email requis",
          "line": 25,
          "column": 20,
          "context": "Variable: errorMessage",
          "type": "string_literal",
          "key": "email_requis"
        }
      ]
    }
  ]
}
```

### Après génération (`./locales/`)
```
locales/
├── fr.json              # Format simple
├── fr-i18next.json      # Format i18next
├── es.json
├── es-i18next.json
└── ...
```

**Exemple `fr.json` :**
```json
{
  "se_connecter": "Se connecter",
  "email_requis": "Email requis",
  "mot_de_passe": "Mot de passe",
  "connexion_reussie": "Connexion réussie !",
  "bienvenue_utilisateur": "Bienvenue {name}"
}
```

**Exemple `fr-i18next.json` :**
```json
{
  "translation": {
    "se_connecter": "Se connecter",
    "email_requis": "Email requis",
    "mot_de_passe": "Mot de passe",
    "connexion_reussie": "Connexion réussie !",
    "bienvenue_utilisateur": "Bienvenue {{name}}"
  }
}
```

## 🎯 Exemples par cas d'usage

### Projet React avec TypeScript
```bash
# Structure typique
src/
├── components/
│   ├── Button.tsx        # <Button>Confirmer</Button>
│   └── Modal.tsx         # const title = "Erreur de validation"
├── pages/
│   └── Login.tsx         # <h1>{"Connexion"}</h1>
└── utils/
    └── messages.ts       # export const ERRORS = { ... }

# Commandes
translate-ai init
translate-ai scan -d src
translate-ai generate -l fr es de
```

### Projet avec patterns personnalisés
```bash
# Exclure les tests et inclure seulement les composants
translate-ai scan \
  -p "src/components/**/*.{tsx,jsx}" \
  -p "src/pages/**/*.{tsx,jsx}" \
  -e "**/*.test.*" \
  -e "**/*.spec.*" \
  -o components-strings.json
```

### Traduction batch avec contexte
```bash
# Le contexte aide l'IA à mieux traduire
# Ex: "Close" -> "Fermer" (bouton) vs "Proche" (adjectif)

# Génération avec OpenAI (meilleur pour le contexte)
translate-ai generate -p openai -l fr es it de pt
```

## 🔧 Configuration avancée

### Variables d'environnement
```bash
# .env
OPENAI_API_KEY=sk-your-openai-key
DEEPL_API_KEY=your-deepl-key

# Ou export
export OPENAI_API_KEY=sk-your-key
export DEEPL_API_KEY=your-key
```

### Configuration personnalisée (`translate-ai.config.json`)
```json
{
  "projectName": "mon-app",
  "frameworks": ["react"],
  "languages": ["en", "fr", "es", "de"],
  "outputDir": "./src/i18n/locales",
  "filePatterns": [
    "src/**/*.{tsx,jsx}",
    "src/**/*.ts"
  ],
  "excludePatterns": [
    "node_modules/**",
    "**/*.test.*",
    "**/*.stories.*"
  ],
  "translationOptions": {
    "provider": "openai",
    "batchSize": 10,
    "includeContext": true
  }
}
```

## 🧪 Test avec projet exemple

### Créer un projet test
```bash
mkdir test-translate-ai && cd test-translate-ai
npm init -y
npm install react @types/react

# Créer des fichiers exemples
mkdir -p src/components
```

**`src/components/Welcome.tsx`**
```tsx
import React from 'react';

export const Welcome = ({ name }: { name: string }) => {
  const greeting = "Bienvenue sur notre application";
  const subtitle = `Bonjour ${name}, content de vous voir !`;
  
  return (
    <div>
      <h1>{greeting}</h1>
      <p>{subtitle}</p>
      <button onClick={() => alert("Action confirmée")}>
        Continuer
      </button>
    </div>
  );
};
```

**Tester le scan :**
```bash
translate-ai scan
# Devrait détecter: "Bienvenue sur notre application", "Bonjour {name}, content de vous voir !", "Action confirmée", "Continuer"
```

## 📊 Métriques et monitoring

### Vérifier le statut
```bash
translate-ai status
# 📊 Project Status
# Configuration: ✅ Found
# Extracted strings: ✅ Found (42 strings in 8 files)
# Latest scan: 2024-01-15 10:30:00
```

### Analyser les résultats
```bash
# Le scan génère automatiquement un résumé
translate-ai scan
# 📁 Scanning 15 files...
# ✅ src/components/Button.tsx: 3 strings found
# ⚪ src/utils/helpers.ts: no translatable strings
# 📊 SCAN SUMMARY
# Files scanned: 15
# Translatable strings found: 42
```

## 🚀 Intégration dans le workflow

### CI/CD avec GitHub Actions
```yaml
# .github/workflows/i18n-check.yml
name: Translation Check
on: [push, pull_request]

jobs:
  check-translations:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
    - run: npm install -g translate-ai
    - run: translate-ai scan
    - run: translate-ai generate -l fr es
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Hook pre-commit
```bash
#!/bin/sh
# .git/hooks/pre-commit
translate-ai scan --quiet
if [ $? -ne 0 ]; then
  echo "❌ New translatable strings detected"
  echo "💡 Run: translate-ai generate"
  exit 1
fi
```

## 🎯 Bonnes pratiques

### 1. Organisation des chaînes
```tsx
// ✅ Bon - contexte clair
const MESSAGES = {
  welcome: "Bienvenue !",
  error: "Une erreur est survenue"
};

// ❌ Éviter - chaînes dispersées
const text1 = "Bonjour";
const text2 = "Au revoir";
```

### 2. Gestion des variables
```tsx
// ✅ Bon - template literals clairs
const welcome = `Bonjour ${username}`;

// ✅ Bon - avec i18next
const welcome = t('welcome_user', { name: username });
```

### 3. Scan régulier
```bash
# Ajouter au package.json
{
  "scripts": {
    "i18n:scan": "translate-ai scan",
    "i18n:translate": "translate-ai generate",
    "i18n:check": "translate-ai status"
  }
}
```
