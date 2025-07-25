# Translate-AI 🌍

Un assistant de traduction alimenté par l'IA pour les développeurs. Scanne automatiquement votre projet, extrait les chaînes traduisibles et génère des traductions via IA.

## 🚀 Installation

```bash
npm install -g translate-ai
# ou
npm install translate-ai --save-dev
```

## 📋 Prérequis

- Node.js 16+
- Projet JavaScript/TypeScript (React pour la v0.1)

## 🎯 Utilisation

### 1. Initialisation

```bash
translate-ai init
```

Crée la configuration initiale pour votre projet.

### 2. Scanner le projet

```bash
translate-ai scan
```

Options disponibles :
- `-d, --dir <directory>` : Répertoire à scanner (défaut: `.`)
- `-o, --output <file>` : Fichier de sortie (défaut: `translatable-strings.json`)
- `-p, --patterns <patterns...>` : Patterns de fichiers à inclure
- `-e, --exclude <patterns...>` : Patterns à exclure

### 3. Générer les traductions

```bash
# Avec OpenAI (nécessite OPENAI_API_KEY)
export OPENAI_API_KEY=sk-your-key-here
translate-ai generate -p openai -l fr es de

# Avec Google Gemini (nécessite GEMINI_API_KEY)
export GEMINI_API_KEY=your-gemini-key
translate-ai generate -p gemini -l fr es de

# Avec DeepL (nécessite DEEPL_API_KEY)
export DEEPL_API_KEY=your-deepl-key
translate-ai generate -p deepl -l fr es it
```

### 4. Vérifier le statut

```bash
translate-ai status
```

## 🧠 Fonctionnalités actuelles

### ✅ Phase 1 (MVP)
- [x] Scanner React/JSX pour extraire les chaînes
- [x] Détection intelligente des chaînes traduisibles
- [x] Interface CLI avec commandes de base
- [x] Export JSON des résultats
- [x] Configuration de projet

### 🚧 En développement
- [ ] Intégration IA pour traductions automatiques
- [ ] Support Vue.js
- [ ] Support Angular
- [ ] Génération de fichiers i18n
- [ ] Validation des traductions

## 🔍 Types de chaînes détectées

### React/JSX
```javascript
// Texte JSX
<h1>Bonjour monde</h1>
<p>{"Message dans une expression"}</p>

// Attributs JSX
<Button label="Confirmer" title="Cliquez ici" />
<img alt="Description de l'image" />

// Variables string
const message = "Erreur de validation";
const greeting = `Bonjour ${name}`;

// Propriétés d'objets
const errors = {
  required: "Ce champ est requis",
  email: "Email invalide"
};
```

## 🏗️ Architecture

```
src/
├── parsers/          # Parseurs par framework
│   └── react-parser.ts
├── scanner.ts        # Scanner de fichiers
├── cli.ts           # Interface CLI
└── types.ts         # Types TypeScript
```

## 📊 Exemple de sortie

```json
{
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "totalFiles": 15,
  "totalStrings": 42,
  "files": [
    {
      "file": "src/components/Button.tsx",
      "stringCount": 3,
      "strings": [
        {
          "text": "Confirmer",
          "line": 12,
          "column": 20,
          "context": "JSX attribute: label",
          "type": "jsx_attribute",
          "key": "confirmer"
        }
      ]
    }
  ]
}
```

## 🤖 Filtres intelligents

Le scanner évite automatiquement :
- Les noms de variables (`className`, `onClick`)
- Les chemins de fichiers (`./src/component`)
- Les valeurs numériques (`42`, `3.14`)
- Les couleurs hex (`#FF0000`)
- Les chaînes trop courtes (< 2 caractères)
- Les espaces uniquement

## 🛠️ Développement

```bash
# Installation des dépendances
npm install

# Développement
npm run dev

# Build
npm run build

# Test local
npm link
translate-ai scan
```

## 📈 Roadmap

### Phase 2 - Traductions IA
- Intégration OpenAI/GPT
- Support Google Gemini
- Support Google Translate API
- Support DeepL API
- Gestion du contexte pour traductions précises

### Phase 3 - Écosystème étendu
- Parseur Vue.js (SFC + templates)
- Parseur Angular (templates + components)
- Support HTML vanilla
- Plugin Webpack/Vite

### Phase 4 - Fonctionnalités avancées
- Interface web
- Extension VS Code
- Validation automatique des traductions
- Gestion des pluriels et genres
- Intégration CI/CD

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licence

MIT - voir [LICENSE](LICENSE) pour plus de détails.

## 🐛 Support

- Issues GitHub : [github.com/votre-repo/translate-ai/issues](github.com/votre-repo/translate-ai/issues)
- Documentation : [docs.translate-ai.dev](docs.translate-ai.dev)

---

Fait avec ❤️ pour simplifier l'internationalisation des projets web.
