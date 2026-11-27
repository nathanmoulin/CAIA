# Caia

Le site de Caia : le commerçant écrit ce qui coince, l'assistant lui pose 4 questions, chiffre l'argent perdu et prend ses coordonnées pour un rappel. Il y a aussi l'espace équipe caché (demandes, analyse, script d'appel, prompts IA).

## Organisation du projet

| Fichier | Rôle |
|---|---|
| `src/page.html` | Tout le site : textes, design, conversation et espace équipe. **C'est le fichier à modifier.** |
| `netlify/functions/caia.mjs` | Les réponses de l'assistant par IA (Claude), côté serveur. |
| `package.json` | La bibliothèque officielle d'Anthropic utilisée par la fonction. |
| `src/config.js` | Les deux réglages de la base de données Supabase. |
| `src/assets/` | Favicon, icône iPhone, image de partage (`og.png`). |
| `build.sh` | Fabrique le site final dans `site/`, avec le référencement Google (titre, description, sitemap, robots, données structurées). |
| `netlify.toml` | Dit à Netlify comment construire et publier le site. |
| `supabase.sql` | Crée la base de données des demandes et ses règles de sécurité. |

**Accès à l'espace équipe** : cliquez sur le « i » du logo caia, tout en bas du site, ou ajoutez `#equipe` à l'adresse.

## 1. Mettre en ligne avec GitHub et Netlify (une seule fois)

1. Le code est sur GitHub, dans ce dépôt.
2. Sur https://app.netlify.com : **Add new site → Import an existing project → GitHub**, puis choisissez ce dépôt.
3. Netlify lit `netlify.toml` tout seul. Cliquez sur **Deploy**.
4. Dans **Forms**, cliquez sur **Enable form detection**, puis relancez un déploiement (**Deploys → Trigger deploy**).
5. Dans **Notifications**, ajoutez un e-mail pour chaque nouvelle demande.

## 2. Mettre à jour le site

Chaque modification envoyée sur GitHub met le site à jour toute seule, en une minute environ.

- **Depuis GitHub** : ouvrez `src/page.html`, cliquez sur le crayon, modifiez, puis cliquez sur **Commit changes**.
- **Avec Claude** : ouvrez une session Claude Code sur ce dépôt et demandez la modification. Elle sera poussée sur GitHub, puis publiée.

## 3. Brancher la base de données (environ 10 min, gratuit)

1. Créez un projet sur https://supabase.com, en région **Europe**.
2. Dans **SQL Editor**, collez `supabase.sql`. Remplacez `TON-EMAIL@exemple.fr` par l'e-mail de chaque membre de l'équipe, puis cliquez sur **Run**.
3. **Authentication → Users → Add user** : créez votre identifiant et votre mot de passe, avec « Auto Confirm User » coché.
4. **Authentication → Sign In / Providers** : désactivez **« Allow new users to sign up »**.
5. **Project Settings → API** : copiez « Project URL » et la clé « anon public » dans `src/config.js`, puis envoyez la modification sur GitHub.

La clé « anon » est faite pour être publique. La sécurité vient des règles de `supabase.sql` :
- le site peut seulement **ajouter** des demandes ;
- seules les personnes de la table `equipe`, une fois connectées, peuvent les lire.

## 4. Activer les réponses par IA (facultatif)

Sans clé, l'assistant fonctionne déjà avec des réponses écrites à l'avance. Avec une clé, deux de ses messages sont rédigés par Claude :
- la première réponse, qui reformule le problème du commerçant ;
- l'explication du diagnostic.

1. Créez une clé API sur https://platform.claude.com (rubrique **API Keys**) et ajoutez un moyen de paiement.
2. Dans Netlify, ouvrez **Site configuration → Environment variables** et ajoutez `ANTHROPIC_API_KEY` avec la clé. Elle reste sur le serveur et n'apparaît jamais dans la page.
3. Relancez un déploiement.

Comment c'est réglé :
- **Modèle** : Claude Opus 5.5, avec un effort de réflexion « bas » (`low`), car ses réponses sont courtes.
- **Relais automatique** : si le modèle refuse une demande, une autre IA reprend la main (option `fallbacks`).
- **Limite** : 20 requêtes par minute et par visiteur, pour éviter les abus.
- **Coût** : environ 4 $ par million de jetons envoyés et 20 $ par million générés. Un diagnostic n'utilise que quelques milliers de jetons.
- **En cas d'erreur** ou de lenteur (plus de 9 secondes), le site reprend ses réponses écrites, sans que le commerçant le remarque.

## 5. Être trouvé sur Google

1. **Nom de domaine** : achetez `caia.fr` (ou `.ai`, `.com`), puis reliez-le dans Netlify (**Domain management → Add a domain**). Le HTTPS est automatique.
2. **Adresse du site** : dans Netlify, **Site configuration → Environment variables**, ajoutez `SITE_URL` = `https://votre-domaine.fr`, puis relancez un déploiement. Le titre, l'image de partage et le sitemap utiliseront cette adresse.
3. **Google Search Console** (https://search.google.com/search-console) :
   - ajoutez le domaine et validez-le (Netlify DNS ou balise HTML) ;
   - dans **Sitemaps**, envoyez `sitemap.xml` ;
   - Google indexe en général le site en quelques jours.
4. **Fiche Google Business Profile** au nom de Caia : elle aide les recherches de marque.

Déjà en place dans le code :
- titre et description optimisés ;
- adresse canonique ;
- image de partage pour WhatsApp, LinkedIn et Facebook ;
- données structurées (entreprise, site) ;
- `robots.txt` et `sitemap.xml` ;
- favicon et icône iPhone.

## 6. Avant d'ouvrir au public

- Complétez les **mentions légales**, en bas de `src/page.html` (cherchez `[Nom de la société]`). Elles sont obligatoires en France.
- Vérifiez que les promesses du site correspondent à ce que l'équipe peut tenir : rappel sous 24 h ouvrées, proposition chiffrée avec le prix.
- Ajustez les **prix** utilisés par l'espace équipe : ligne `const PRIX` dans `src/page.html`.

## Construire en local (facultatif)

```bash
sh build.sh
python3 -m http.server 8080 --directory site
```

Les réponses par IA ne marchent qu'une fois le site sur Netlify. En local, l'assistant utilise ses réponses écrites.
